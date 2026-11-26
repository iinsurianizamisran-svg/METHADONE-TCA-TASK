import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildManualTaskEntries,
  validateManualTaskDraft,
  type ManualTaskDraft,
} from './manualTaskBuilder';

const baseDraft: ManualTaskDraft = {
  patientId: 'pat-1',
  entryType: 'arahan_pegawai',
  title: 'Semakan ujian fungsi hati (LFT) & ECG',
  details: 'Arahan Dr. Hakimah: Ulang ujian darah sebelum pelarasan dos melebihi 60 mg.',
  orderedBy: 'Dr. Hakimah Idris',
  category: 'susulan',
  priority: 'segera',
  dueDate: '2026-11-26',
  dueTime: '09:30',
  repeatCadence: 'sekali',
  repeatCount: 1,
};

test('validateManualTaskDraft rejects missing required fields', () => {
  assert.equal(validateManualTaskDraft({ ...baseDraft, patientId: '' }).valid, false);
  assert.equal(validateManualTaskDraft({ ...baseDraft, title: '  ' }).valid, false);
  assert.equal(validateManualTaskDraft({ ...baseDraft, orderedBy: '' }).valid, false);
  assert.equal(validateManualTaskDraft({ ...baseDraft, dueDate: '' }).valid, false);
  assert.equal(validateManualTaskDraft(baseDraft).valid, true);
});

test('buildManualTaskEntries creates single calendar entry when cadence is sekali', () => {
  const result = buildManualTaskEntries(baseDraft);
  assert.equal(result.length, 1);
  assert.equal(result[0].dueDate, '2026-11-26');
  assert.equal(result[0].entryType, 'arahan_pegawai');
  assert.equal(result[0].orderedBy, 'Dr. Hakimah Idris');
  assert.ok(result[0].details?.includes('Ulang ujian darah'));
  assert.equal(result[0].completed, false);
});

test('buildManualTaskEntries expands weekly repeat entries accurately across calendar dates', () => {
  const result = buildManualTaskEntries({
    ...baseDraft,
    entryType: 'nota_perubatan',
    repeatCadence: 'mingguan',
    repeatCount: 3,
  });
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((r) => r.dueDate),
    ['2026-11-26', '2026-12-03', '2026-12-10']
  );
  assert.equal(result[1].entryType, 'nota_perubatan');
});
