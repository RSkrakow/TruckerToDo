import {test} from 'node:test';
import assert from 'node:assert/strict';

function canEditItem(item, profile, memberships) {
  if (profile.role === 'admin') return true;
  if (profile.role === 'manager') {
    return memberships.some(m => m.area_id === item.area_id && m.user_id === profile.id);
  }
  return false;
}

function prepareUpdatePayload(item, newDescription) {
  return {
    title: item.title,
    description: newDescription,
    type: item.type,
    area_id: item.area_id,
    assigned_to: item.assigned_to,
    due_date: item.due_date,
    status: item.status
  };
}

function hasDescriptionChanged(currentDescription, newDescription) {
  return (newDescription ?? '') !== (currentDescription ?? '');
}

test('permission evaluation preserves area boundaries and manager rights', () => {
  const admin = { id: 'u1', role: 'admin' };
  const managerAreaA = { id: 'u2', role: 'manager' };
  const memberAreaA = { id: 'u3', role: 'member' };

  const memberships = [
    { area_id: 'area-rs', user_id: 'u2' },
    { area_id: 'area-rs', user_id: 'u3' }
  ];

  const itemRS = { id: 'it-1', area_id: 'area-rs', title: 'Zadanie RS', description: 'Opis RS' };
  const itemOther = { id: 'it-2', area_id: 'area-other', title: 'Inne zadanie', description: 'Inny opis' };

  // Admin can edit all
  assert.equal(canEditItem(itemRS, admin, memberships), true);
  assert.equal(canEditItem(itemOther, admin, memberships), true);

  // Manager of area-rs can edit item in area-rs, but not in other areas
  assert.equal(canEditItem(itemRS, managerAreaA, memberships), true);
  assert.equal(canEditItem(itemOther, managerAreaA, memberships), false);

  // Member cannot edit details in any area
  assert.equal(canEditItem(itemRS, memberAreaA, memberships), false);
  assert.equal(canEditItem(itemOther, memberAreaA, memberships), false);
});

test('change detection and payload creation strictly preserves existing fields', () => {
  const original = {
    id: '123',
    title: 'Wdrożyć moduł',
    description: 'Linia 1\nLinia 2',
    type: 'task',
    area_id: 'area-1',
    assigned_to: 'user-9',
    due_date: '2026-11-20',
    status: 'in_progress'
  };

  assert.equal(hasDescriptionChanged(original.description, 'Linia 1\nLinia 2'), false);
  assert.equal(hasDescriptionChanged(original.description, 'Linia 1\nLinia 2\nLinia 3'), true);
  assert.equal(hasDescriptionChanged(null, ''), false);
  assert.equal(hasDescriptionChanged(null, 'Nowy opis'), true);

  const payload = prepareUpdatePayload(original, 'Zaktualizowany opis\nZ formatowaniem');
  assert.deepEqual(payload, {
    title: 'Wdrożyć moduł',
    description: 'Zaktualizowany opis\nZ formatowaniem',
    type: 'task',
    area_id: 'area-1',
    assigned_to: 'user-9',
    due_date: '2026-11-20',
    status: 'in_progress'
  });
});

function resolveTrackerReturnUrl(from, savedUrl) {
  if (from && from !== '/') {
    try {
      return decodeURIComponent(from);
    } catch {
      return from;
    }
  }
  if (savedUrl && savedUrl !== '/') {
    return savedUrl;
  }
  return '/';
}

function buildItemNextUrl(resultId, returnHref) {
  const fromParam = returnHref && returnHref !== '/' ? returnHref : null;
  return `/items/${resultId}` + (fromParam ? `?from=${encodeURIComponent(fromParam)}` : '');
}

test('tracker return url and next url preserve search filters across full edit', () => {
  const activeFilters = '/?tab=task&area=area-rs&status=active&q=pilne';

  // Resolves direct from parameter
  assert.equal(
    resolveTrackerReturnUrl(encodeURIComponent(activeFilters), null),
    activeFilters
  );

  // Falls back to saved sessionStorage URL if from is missing or bare '/'
  assert.equal(
    resolveTrackerReturnUrl('/', activeFilters),
    activeFilters
  );
  assert.equal(
    resolveTrackerReturnUrl(undefined, activeFilters),
    activeFilters
  );

  // Returns '/' when no filters exist
  assert.equal(resolveTrackerReturnUrl(undefined, null), '/');

  // Preserves from parameter after saving item in ItemForm
  assert.equal(
    buildItemNextUrl('item-123', activeFilters),
    `/items/item-123?from=${encodeURIComponent(activeFilters)}`
  );
  assert.equal(
    buildItemNextUrl('item-123', '/'),
    '/items/item-123'
  );
});
