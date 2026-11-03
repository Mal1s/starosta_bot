/*
# Registration System Migration

1. Groups: invite_token (plaintext unique), join_paused, recovery_ack_at; drop invite_token_hash
2. Memberships: consent_at, consent_version, roster_id, rejected, reject_reason, decided_by, decided_at, via
3. Users: onboarding jsonb
4. Indexes: memberships_user_idx, roster_group_idx
5. SQL Functions: create_group, resolve_invite, join_group, decide_membership, restore_headman, get_user_state
6. Security: SECURITY DEFINER, execute revoked from PUBLIC/anon
*/

ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_token text UNIQUE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS join_paused boolean NOT NULL DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS recovery_ack_at timestamptz;
UPDATE groups SET invite_token = translate(encode(gen_random_bytes(16),'base64'),'+/=','-_') WHERE invite_token IS NULL;
ALTER TABLE groups DROP COLUMN IF EXISTS invite_token_hash;

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS consent_at timestamptz;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS consent_version smallint;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS roster_id uuid REFERENCES roster(id) ON DELETE SET NULL;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS rejected boolean NOT NULL DEFAULT false;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES memberships(id) ON DELETE SET NULL;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS via text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{"tour_seen":false}'::jsonb;

CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id, status);
CREATE INDEX IF NOT EXISTS roster_group_idx ON roster(group_id);

-- ========== create_group ==========
CREATE OR REPLACE FUNCTION create_group(
  p_user_id uuid,
  p_name text,
  p_full_name text,
  p_institution text DEFAULT NULL,
  p_course int DEFAULT NULL,
  p_timezone text DEFAULT 'Europe/Moscow',
  p_via text DEFAULT 'link'
) RETURNS TABLE(
  group_id uuid, membership_id uuid, invite_token text, short_code text, recovery_code text
) AS $$
DECLARE
  v_group record; v_membership record;
  v_token text; v_code text; v_rec_code text; v_rec_hash text; v_pepper text; i int;
BEGIN
  PERFORM 1 FROM memberships WHERE user_id = p_user_id AND status IN ('active','pending');
  IF FOUND THEN RAISE EXCEPTION 'ALREADY_IN_GROUP'; END IF;

  FOR i IN 1..5 LOOP
    v_token := translate(encode(gen_random_bytes(16), 'base64'), '+/=', '-_');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE invite_token = v_token);
    v_token := NULL;
  END LOOP;
  IF v_token IS NULL THEN RAISE EXCEPTION 'TOKEN_COLLISION'; END IF;

  FOR i IN 1..5 LOOP
    v_code := substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 1, 3)
           || '-' || substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 1, 3);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE short_code = v_code);
    v_code := NULL;
  END LOOP;
  IF v_code IS NULL THEN RAISE EXCEPTION 'CODE_COLLISION'; END IF;

  v_rec_code := substr(translate(encode(gen_random_bytes(12), 'base64'), '+/=', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 1, 4)
             || '-' || substr(translate(encode(gen_random_bytes(12), 'base64'), '+/=', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 1, 4)
             || '-' || substr(translate(encode(gen_random_bytes(12), 'base64'), '+/=', 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 1, 4);

  v_pepper := COALESCE(current_setting('app.recovery_pepper', true), 'fallback_pepper');
  v_rec_hash := encode(hmac(v_rec_code::bytea, v_pepper::bytea, 'sha256'), 'hex');

  INSERT INTO groups (name, institution, course, timezone, invite_token, short_code, recovery_hash)
  VALUES (p_name, p_institution, p_course, p_timezone, v_token, v_code, v_rec_hash)
  RETURNING * INTO v_group;

  INSERT INTO memberships (group_id, user_id, role, status, full_name, via)
  VALUES (v_group.id, p_user_id, 'headman', 'active', p_full_name, p_via)
  RETURNING * INTO v_membership;

  INSERT INTO bell_schedule (group_id, lesson_no, starts, ends) VALUES
    (v_group.id, 1, '08:30', '10:00'), (v_group.id, 2, '10:10', '11:40'),
    (v_group.id, 3, '11:50', '13:20'), (v_group.id, 4, '13:50', '15:20'),
    (v_group.id, 5, '15:30', '17:00'), (v_group.id, 6, '17:10', '18:40');

  INSERT INTO audit_log (group_id, actor_id, action, entity, entity_id) VALUES (v_group.id, p_user_id, 'group.create', 'group', v_group.id::text);
  INSERT INTO leadership_events (group_id, type, target_id) VALUES (v_group.id, 'created', v_membership.id);

  RETURN QUERY SELECT v_group.id, v_membership.id, v_token, v_code, v_rec_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== resolve_invite ==========
CREATE OR REPLACE FUNCTION resolve_invite(
  p_token text DEFAULT NULL, p_code text DEFAULT NULL
) RETURNS TABLE(
  grp jsonb, headman_name text, member_count bigint, member_limit int, join_mode text, subgroups jsonb, roster_unassigned jsonb, already_member boolean
) AS $$
DECLARE
  v_group record; v_normalized_code text; v_headman_name text; v_count bigint; v_subs jsonb; v_roster jsonb;
BEGIN
  v_normalized_code := translate(upper(replace(replace(COALESCE(p_code, ''), ' ', ''), '-', '')), 'АВЕКМНРСТХ', 'ABEKMHPCTX');

  IF p_token IS NOT NULL AND p_token <> '' THEN
    SELECT * INTO v_group FROM groups WHERE invite_token = p_token AND state != 'pending_deletion';
  ELSIF v_normalized_code <> '' THEN
    SELECT * INTO v_group FROM groups WHERE short_code = v_normalized_code AND state != 'pending_deletion';
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
  IF v_group.invite_expires_at IS NOT NULL AND v_group.invite_expires_at < now() THEN RAISE EXCEPTION 'INVITE_EXPIRED'; END IF;
  IF v_group.state = 'pending_deletion' THEN RAISE EXCEPTION 'GROUP_DELETING'; END IF;
  IF v_group.join_paused THEN RAISE EXCEPTION 'JOIN_PAUSED'; END IF;

  SELECT count(*) INTO v_count FROM memberships WHERE group_id = v_group.id AND status = 'active';
  IF v_count >= v_group.member_limit THEN RAISE EXCEPTION 'GROUP_FULL'; END IF;

  SELECT split_part(full_name, ' ', 2) INTO v_headman_name
  FROM memberships WHERE group_id = v_group.id AND role = 'headman' AND status = 'active' LIMIT 1;
  IF v_headman_name = '' OR v_headman_name IS NULL THEN v_headman_name := 'Староста'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]'::jsonb) INTO v_subs
  FROM subgroups WHERE group_id = v_group.id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name)), '[]'::jsonb) INTO v_roster
  FROM roster WHERE group_id = v_group.id AND membership_id IS NULL;

  RETURN QUERY SELECT to_jsonb(v_group), v_headman_name, v_count, v_group.member_limit, v_group.join_mode::text, v_subs, v_roster, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== join_group ==========
CREATE OR REPLACE FUNCTION join_group(
  p_user_id uuid, p_full_name text,
  p_token text DEFAULT NULL, p_code text DEFAULT NULL,
  p_roster_id uuid DEFAULT NULL, p_subgroup_ids uuid[] DEFAULT NULL,
  p_consent_version smallint DEFAULT 1, p_via text DEFAULT 'link'
) RETURNS TABLE(membership_id uuid, membership_status text, next_action text) AS $$
DECLARE
  v_group record; v_normalized_code text; v_existing record; v_new_membership record; v_status text; v_next text;
BEGIN
  v_normalized_code := translate(upper(replace(replace(COALESCE(p_code, ''), ' ', ''), '-', '')), 'АВЕКМНРСТХ', 'ABEKMHPCTX');

  IF p_token IS NOT NULL AND p_token <> '' THEN
    SELECT * INTO v_group FROM groups WHERE invite_token = p_token AND state != 'pending_deletion';
  ELSIF v_normalized_code <> '' THEN
    SELECT * INTO v_group FROM groups WHERE short_code = v_normalized_code AND state != 'pending_deletion';
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
  IF v_group.invite_expires_at IS NOT NULL AND v_group.invite_expires_at < now() THEN RAISE EXCEPTION 'INVITE_EXPIRED'; END IF;
  IF v_group.join_paused THEN RAISE EXCEPTION 'JOIN_PAUSED'; END IF;

  IF (SELECT count(*) FROM memberships WHERE group_id = v_group.id AND status = 'active') >= v_group.member_limit THEN
    RAISE EXCEPTION 'GROUP_FULL';
  END IF;

  PERFORM 1 FROM memberships WHERE user_id = p_user_id AND status IN ('active','pending') AND group_id != v_group.id;
  IF FOUND THEN RAISE EXCEPTION 'ALREADY_IN_GROUP'; END IF;

  SELECT * INTO v_existing FROM memberships WHERE group_id = v_group.id AND user_id = p_user_id LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status = 'active' THEN
      RETURN QUERY SELECT v_existing.id, 'active', 'enter'; RETURN;
    ELSIF v_existing.status = 'left' THEN
      UPDATE memberships SET status = 'active', full_name = p_full_name, consent_at = now(), consent_version = p_consent_version, via = p_via WHERE id = v_existing.id;
      RETURN QUERY SELECT v_existing.id, 'active', 'enter'; RETURN;
    ELSIF v_existing.status = 'pending' THEN
      UPDATE memberships SET full_name = p_full_name, consent_at = now(), consent_version = p_consent_version WHERE id = v_existing.id;
      RETURN QUERY SELECT v_existing.id, 'pending', 'wait_approval'; RETURN;
    ELSIF v_existing.status = 'removed' THEN
      IF v_existing.left_at IS NOT NULL AND v_existing.left_at > now() - interval '24 hours' THEN RAISE EXCEPTION 'REJOIN_BLOCKED'; END IF;
      UPDATE memberships SET status = 'pending', full_name = p_full_name, rejected = false, reject_reason = NULL,
        consent_at = now(), consent_version = p_consent_version, via = p_via, decided_by = NULL, decided_at = NULL WHERE id = v_existing.id;
      RETURN QUERY SELECT v_existing.id, 'pending', 'wait_approval'; RETURN;
    END IF;
  END IF;

  IF p_roster_id IS NOT NULL THEN
    PERFORM 1 FROM roster WHERE id = p_roster_id AND membership_id IS NOT NULL;
    IF FOUND THEN RAISE EXCEPTION 'ROSTER_TAKEN'; END IF;
  END IF;

  v_status := CASE WHEN v_group.join_mode = 'auto' THEN 'active' ELSE 'pending' END;
  v_next := CASE WHEN v_group.join_mode = 'auto' THEN 'enter' ELSE 'wait_approval' END;

  INSERT INTO memberships (group_id, user_id, role, status, full_name, consent_at, consent_version, roster_id, via)
  VALUES (v_group.id, p_user_id, 'student', v_status, p_full_name, now(), p_consent_version, p_roster_id, p_via)
  RETURNING * INTO v_new_membership;

  IF p_roster_id IS NOT NULL THEN UPDATE roster SET membership_id = v_new_membership.id WHERE id = p_roster_id; END IF;

  IF p_subgroup_ids IS NOT NULL AND array_length(p_subgroup_ids, 1) > 0 THEN
    INSERT INTO membership_subgroups (membership_id, subgroup_id)
    SELECT v_new_membership.id, s.id FROM subgroups s WHERE s.id = ANY(p_subgroup_ids) AND s.group_id = v_group.id;
  END IF;

  INSERT INTO audit_log (group_id, actor_id, action, entity, entity_id)
  VALUES (v_group.id, p_user_id, CASE WHEN v_status = 'active' THEN 'member.join' ELSE 'member.join_request' END, 'membership', v_new_membership.id::text);

  RETURN QUERY SELECT v_new_membership.id, v_status, v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== decide_membership ==========
CREATE OR REPLACE FUNCTION decide_membership(
  p_membership_id uuid, p_decider_id uuid, p_approve boolean, p_reason text DEFAULT NULL
) RETURNS void AS $$
DECLARE v_membership record;
BEGIN
  SELECT * INTO v_membership FROM memberships WHERE id = p_membership_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF p_approve THEN
    UPDATE memberships SET status = 'active', decided_by = p_decider_id, decided_at = now(), rejected = false WHERE id = p_membership_id;
    INSERT INTO audit_log (group_id, actor_id, action, entity, entity_id) VALUES (v_membership.group_id, p_decider_id, 'member.approve', 'membership', p_membership_id::text);
  ELSE
    UPDATE memberships SET status = 'removed', rejected = true, reject_reason = p_reason, decided_by = p_decider_id, decided_at = now(), left_at = now() WHERE id = p_membership_id;
    INSERT INTO audit_log (group_id, actor_id, action, entity, entity_id) VALUES (v_membership.group_id, p_decider_id, 'member.reject', 'membership', p_membership_id::text);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== restore_headman ==========
CREATE OR REPLACE FUNCTION restore_headman(p_user_id uuid, p_recovery_code text)
RETURNS TABLE(group_id uuid, membership_id uuid) AS $$
DECLARE
  v_normalized text; v_hash text; v_group record; v_old_headman record; v_membership record; v_pepper text;
BEGIN
  v_normalized := translate(upper(replace(replace(COALESCE(p_recovery_code, ''), ' ', ''), '-', '')), 'АВЕКМНРСТХ', 'ABEKMHPCTX');
  v_pepper := COALESCE(current_setting('app.recovery_pepper', true), 'fallback_pepper');
  v_hash := encode(hmac(v_normalized::bytea, v_pepper::bytea, 'sha256'), 'hex');

  SELECT * INTO v_group FROM groups WHERE recovery_hash = v_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECOVERY_INVALID'; END IF;

  PERFORM 1 FROM memberships WHERE user_id = p_user_id AND status IN ('active','pending') AND group_id != v_group.id;
  IF FOUND THEN RAISE EXCEPTION 'ALREADY_IN_GROUP'; END IF;

  SELECT * INTO v_old_headman FROM memberships WHERE group_id = v_group.id AND role = 'headman' AND status = 'active';
  IF v_old_headman.id IS NOT NULL AND v_old_headman.user_id != p_user_id THEN
    UPDATE memberships SET role = 'student' WHERE id = v_old_headman.id;
  END IF;

  SELECT * INTO v_membership FROM memberships WHERE group_id = v_group.id AND user_id = p_user_id LIMIT 1;
  IF v_membership.id IS NOT NULL THEN
    UPDATE memberships SET role = 'headman', status = 'active', full_name = COALESCE(v_membership.full_name, 'Староста') WHERE id = v_membership.id RETURNING * INTO v_membership;
  ELSE
    INSERT INTO memberships (group_id, user_id, role, status, full_name, via)
    VALUES (v_group.id, p_user_id, 'headman', 'active', COALESCE(v_old_headman.full_name, 'Староста'), 'restore') RETURNING * INTO v_membership;
  END IF;

  IF v_group.state = 'no_headman' THEN UPDATE groups SET state = 'active' WHERE id = v_group.id; END IF;

  INSERT INTO leadership_events (group_id, type, target_id) VALUES (v_group.id, 'recovered', v_membership.id);
  INSERT INTO audit_log (group_id, actor_id, action, entity, entity_id) VALUES (v_group.id, p_user_id, 'group.restore', 'group', v_group.id::text);

  RETURN QUERY SELECT v_group.id, v_membership.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== get_user_state ==========
CREATE OR REPLACE FUNCTION get_user_state(p_user_id uuid)
RETURNS TABLE(state text, membership_data jsonb, group_data jsonb) AS $$
DECLARE
  v_mem_id uuid; v_mem_group_id uuid; v_mem_user_id uuid; v_mem_role text; v_mem_status text;
  v_mem_full_name text; v_mem_joined_at timestamptz; v_mem_left_at timestamptz;
  v_grp_id uuid; v_grp_name text; v_grp_state text; v_grp_timezone text; v_grp_delete_after timestamptz;
  v_grp_theme text; v_grp_background text; v_grp_onboarding jsonb;
  v_state text;
  v_found boolean := false;
BEGIN
  SELECT m.id, m.group_id, m.user_id, m.role, m.status, m.full_name, m.joined_at, m.left_at
  INTO v_mem_id, v_mem_group_id, v_mem_user_id, v_mem_role, v_mem_status, v_mem_full_name, v_mem_joined_at, v_mem_left_at
  FROM memberships m WHERE m.user_id = p_user_id AND m.status IN ('active', 'pending') LIMIT 1;

  v_found := v_mem_id IS NOT NULL;

  IF v_found THEN
    SELECT g.id, g.name, g.state, g.timezone, g.delete_after, g.theme, g.background, g.onboarding
    INTO v_grp_id, v_grp_name, v_grp_state, v_grp_timezone, v_grp_delete_after, v_grp_theme, v_grp_background, v_grp_onboarding
    FROM groups g WHERE g.id = v_mem_group_id;
  END IF;

  IF NOT v_found THEN
    SELECT id, rejected, status, left_at INTO v_mem_id, v_mem_role, v_mem_status, v_mem_left_at
    FROM memberships WHERE user_id = p_user_id ORDER BY left_at DESC NULLS LAST LIMIT 1;
    IF v_mem_id IS NOT NULL AND v_mem_role = 'true' AND v_mem_status = 'removed' THEN
      v_state := 'rejected';
    ELSIF v_mem_id IS NOT NULL AND v_mem_status = 'removed' THEN
      v_state := 'removed';
    ELSE
      v_state := 'new';
    END IF;
    RETURN QUERY SELECT v_state, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  IF v_mem_status = 'pending' THEN v_state := 'pending';
  ELSIF v_mem_status = 'active' THEN
    v_state := CASE WHEN v_mem_role = 'student' THEN 'active_student' WHEN v_mem_role = 'deputy' THEN 'active_deputy' WHEN v_mem_role = 'headman' THEN 'active_headman' ELSE 'active_student' END;
  END IF;

  IF v_grp_state = 'pending_deletion' THEN v_state := 'group_deleting';
  ELSIF v_grp_state = 'no_headman' THEN v_state := 'group_no_headman'; END IF;

  RETURN QUERY SELECT v_state,
    jsonb_build_object('id', v_mem_id, 'group_id', v_mem_group_id, 'user_id', v_mem_user_id, 'role', v_mem_role, 'status', v_mem_status, 'full_name', v_mem_full_name, 'joined_at', v_mem_joined_at, 'left_at', v_mem_left_at),
    jsonb_build_object('id', v_grp_id, 'name', v_grp_name, 'state', v_grp_state, 'timezone', v_grp_timezone, 'delete_after', v_grp_delete_after, 'theme', v_grp_theme, 'background', v_grp_background, 'onboarding', v_grp_onboarding);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION create_group(uuid, text, text, text, int, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION resolve_invite(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION join_group(uuid, text, text, text, uuid, uuid[], smallint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION decide_membership(uuid, uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION restore_headman(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_user_state(uuid) FROM PUBLIC, anon;