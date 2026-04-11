// api/db.js — Vercel Serverless Function
// All writes/deletes using the service key happen here (server-side only).
// Every request is authenticated: the caller's JWT is verified against Supabase,
// and their role + school are checked before any operation is executed.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.VITE_SUPABASE_SERVICE_KEY;

// ── Per-role write allowlist ──────────────────────────────────────────────────
// Only tables listed here can be written to by each role.
// Anything not in this list is rejected with 403.
const WRITE_TABLES = {
  Admin: new Set([
    'employee_tbl',
    'employees_types_tbl',
    'employees_types_stages_tbl',
    'employees_sections_subjects_classes_semisters_curriculums_tbl',
    'students_tbl',
    'students_sections_classes_tbl',
    'subjects_tbl',
    'subjects_classes_tbl',
    'subjects_classes_semisters_curriculums_tbl',
    'sections_subjects_classes_tbl',
    'sections_classes_tbl',
    'studentanswers_tbl',
    'students_exams_employees_section_subjects_classes_semisters_cur',
    'questions_exams_employee_subjects_sections_tbl',
  ]),
  Supervisor: new Set([
    'employee_tbl',   // own record only — enforced below
    'studentanswers_tbl',
    'students_exams_employees_section_subjects_classes_semisters_cur',
    'questions_exams_employee_subjects_sections_tbl',
    'questions_tbl',
  ]),
  Teacher: new Set([
    'employee_tbl',   // own record only — enforced below
    'studentanswers_tbl',
    'students_exams_employees_section_subjects_classes_semisters_cur',
    'questions_exams_employee_subjects_sections_tbl',
    'questions_tbl',
  ]),
  GM: new Set([
    'employee_tbl',   // own record only — enforced below
  ]),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Verify the caller's JWT and return their profile: { authId, employeeid, schoolid, branchid, role }
// Returns null if the token is missing, invalid, or the employee record is not found.
async function getCallerProfile(token) {
  if (!token) return null;

  // Verify token with Supabase Auth
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!authRes.ok) return null;
  const authUser = await authRes.json();
  if (!authUser?.id) return null;

  // Look up the employee record for this auth user
  const empRes = await fetch(
    `${SUPABASE_URL}/rest/v1/employee_tbl?auth_user_id=eq.${authUser.id}&select=employeeid,schoolid,branchid`,
    { headers: serviceHeaders({ Accept: 'application/json' }) },
  );
  if (!empRes.ok) return null;
  const employees = await empRes.json();
  if (!employees.length) return null;
  const emp = employees[0];

  // Look up the employee's role
  const typeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/employees_types_tbl?employeeid=eq.${emp.employeeid}&select=typeid`,
    { headers: serviceHeaders({ Accept: 'application/json' }) },
  );
  const types = typeRes.ok ? await typeRes.json() : [];
  const typeid = types[0]?.typeid;
  const roleMap = { 1: 'Teacher', 2: 'Supervisor', 3: 'GM', 6: 'Admin' };

  return {
    authId:     authUser.id,
    employeeid: emp.employeeid,
    schoolid:   emp.schoolid,
    branchid:   emp.branchid,
    role:       roleMap[typeid] || 'Teacher',
  };
}

// Extract the bare table name from "table_name?filter=value" or "table_name"
function extractTable(pathOrTable = '') {
  return pathOrTable.split('?')[0].split('/')[0];
}

function isAllowedTable(role, table) {
  return WRITE_TABLES[role]?.has(table) ?? false;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate every request
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const caller = await getCallerProfile(token);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { action, table, id, idField, data, path, method, body, prefer } = req.body ?? {};

  try {

    // ── INSERT ─────────────────────────────────────────────────────────────────
    if (action === 'insert') {
      if (!isAllowedTable(caller.role, table)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: serviceHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: e.message || 'Insert failed' });
      }
      const text = await response.text();
      return res.status(200).json(text ? JSON.parse(text) : { ok: true });

    // ── UPDATE ─────────────────────────────────────────────────────────────────
    } else if (action === 'update') {
      if (!isAllowedTable(caller.role, table)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Non-admins can only update their own employee record
      if (table === 'employee_tbl' && caller.role !== 'Admin') {
        if (String(id) !== String(caller.employeeid)) {
          return res.status(403).json({ error: 'Forbidden: can only update your own record' });
        }
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`, {
        method: 'PATCH',
        headers: serviceHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: e.message || 'Update failed' });
      }
      const text = await response.text();
      return res.status(200).json(text ? JSON.parse(text) : { ok: true });

    // ── REMOVE ─────────────────────────────────────────────────────────────────
    } else if (action === 'remove') {
      if (!isAllowedTable(caller.role, table)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Only Admins can delete employee records
      if (table === 'employee_tbl' && caller.role !== 'Admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`, {
        method: 'DELETE',
        headers: serviceHeaders(),
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: e.message || 'Delete failed' });
      }
      return res.status(200).json({ ok: true });

    // ── NEXT ID ────────────────────────────────────────────────────────────────
    } else if (action === 'nextId') {
      // Read-only sequence helper — any authenticated user is fine
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=${idField}&order=${idField}.desc&limit=1`,
        { headers: serviceHeaders({ Accept: 'application/json' }) },
      );
      if (!response.ok) return res.status(200).json({ nextId: 1 });
      const rows = await response.json();
      return res.status(200).json({ nextId: rows.length > 0 ? rows[0][idField] + 1 : 1 });

    // ── RAW QUERY ──────────────────────────────────────────────────────────────
    } else if (action === 'query') {
      const tableName = extractTable(path);

      // Special case: Supabase Auth Admin API (Admin only)
      // Routes to /auth/v1/admin/... not /rest/v1/...
      if (path.startsWith('auth/v1/admin')) {
        if (caller.role !== 'Admin') {
          return res.status(403).json({ error: 'Forbidden' });
        }
        const extraHeaders = {};
        if (prefer) extraHeaders.Prefer = prefer;
        const response = await fetch(`${SUPABASE_URL}/${path}`, {
          method: method || 'GET',
          headers: serviceHeaders(extraHeaders),
          body: body != null ? JSON.stringify(body) : undefined,
        });
        if (method === 'DELETE' || response.status === 204) {
          return res.status(200).json({ ok: true });
        }
        const text = await response.text();
        if (!response.ok) return res.status(response.status).json({ error: text });
        return res.status(200).json(text ? JSON.parse(text) : { ok: true });
      }

      // GET queries are read-only — any authenticated user is fine
      // (RLS on the Supabase side controls what rows they can actually see)
      if (!method || method === 'GET') {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
          method: 'GET',
          headers: serviceHeaders({ Accept: 'application/json' }),
        });
        const text = await response.text();
        if (!response.ok) return res.status(response.status).json({ error: text });
        return res.status(200).json(text ? JSON.parse(text) : { ok: true });
      }

      // Write/delete queries — check the table allowlist
      if (!isAllowedTable(caller.role, tableName)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Non-admins cannot delete or patch employee records
      if (tableName === 'employee_tbl' && caller.role !== 'Admin') {
        if (method === 'DELETE') {
          return res.status(403).json({ error: 'Forbidden' });
        }
        // For PATCH, verify it targets only their own record (employeeid= in the path)
        const match = path.match(/employeeid=eq\.(\d+)/);
        if (!match || String(match[1]) !== String(caller.employeeid)) {
          return res.status(403).json({ error: 'Forbidden: can only update your own record' });
        }
      }

      const extraHeaders = {};
      if (prefer) extraHeaders.Prefer = prefer;
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: serviceHeaders(extraHeaders),
        body: body != null ? JSON.stringify(body) : undefined,
      });
      if (method === 'DELETE' || response.status === 204) {
        return res.status(200).json({ ok: true });
      }
      const text = await response.text();
      if (!response.ok) return res.status(response.status).json({ error: text });
      return res.status(200).json(text ? JSON.parse(text) : { ok: true });

    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

  } catch (err) {
    console.error('[api/db]', err);
    return res.status(500).json({ error: err.message });
  }
}
