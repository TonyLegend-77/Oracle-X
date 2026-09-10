-- Voice-note entries were never actually processed (no transcription, no
-- audio handling anywhere in the app) -- the "voice" type was label-only.
-- Removing it from the allowed set. Any existing rows with type = 'voice'
-- are relabeled as 'file' rather than deleted, so no data is lost and the
-- new constraint can be added cleanly.

UPDATE entries SET type = 'file' WHERE type = 'voice';

ALTER TABLE entries DROP CONSTRAINT entries_type_check;
ALTER TABLE entries ADD CONSTRAINT entries_type_check CHECK (type IN ('text', 'file'));
