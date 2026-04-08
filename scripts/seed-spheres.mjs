import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("railway") ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const client = await pool.connect();
  try {
    // Ensure sphere column exists
    await client.query(
      "ALTER TABLE npa_documents ADD COLUMN IF NOT EXISTS sphere VARCHAR(30) DEFAULT 'land'"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_npa_sphere ON npa_documents(sphere)"
    );

    // Get or create iteration
    const iterRes = await client.query("SELECT id FROM iterations WHERE iteration_number = 1");
    let iterationId;
    if (iterRes.rows.length > 0) {
      iterationId = iterRes.rows[0].id;
    } else {
      const newIter = await client.query(
        "INSERT INTO iterations (iteration_number, status, description) VALUES (1, 'active', 'Первичная экспертиза') RETURNING id"
      );
      iterationId = newIter.rows[0].id;
    }
    console.log(`Using iteration id=${iterationId}`);

    // Files to load
    const files = [
      { path: path.resolve(__dirname, "../requirements_transport.json"), sphere: null },
      { path: path.resolve(__dirname, "../requirements_ecology.json"), sphere: null },
    ];

    let totalLoaded = 0;

    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        console.warn(`File not found: ${file.path}, skipping`);
        continue;
      }

      const data = JSON.parse(fs.readFileSync(file.path, "utf-8"));
      const sphere = data.metadata?.sphere || file.sphere || "unknown";
      const requirements = data.requirements || [];
      console.log(`\nLoading ${requirements.length} requirements from sphere "${sphere}"...`);

      // Collect unique NPAs
      const npaMap = new Map();
      const uniqueNpas = new Set();
      for (const r of requirements) {
        if (r.npa_title) uniqueNpas.add(r.npa_title);
      }

      for (const title of uniqueNpas) {
        const code = title.substring(0, 50).replace(/[^a-zA-Zа-яА-Я0-9_\-]/g, "_");
        const res = await client.query(
          `INSERT INTO npa_documents (code, title, category, sphere)
           VALUES ($1, $2, 'закон', $3)
           ON CONFLICT (code) DO UPDATE SET sphere = $3
           RETURNING id`,
          [code, title, sphere]
        );
        npaMap.set(title, res.rows[0].id);
      }
      console.log(`  ${npaMap.size} NPA documents created/updated`);

      // Check for existing requirements to avoid duplicates
      let loaded = 0;
      let skipped = 0;
      for (const r of requirements) {
        const externalId = r.id || null;

        // Skip if this external_id already exists
        if (externalId) {
          const existing = await client.query(
            "SELECT id FROM requirements WHERE external_id = $1",
            [externalId]
          );
          if (existing.rows.length > 0) {
            skipped++;
            continue;
          }
        }

        const npaTitle = r.npa_title;
        const npaId = npaMap.get(npaTitle) || null;

        await client.query(
          `INSERT INTO requirements
            (iteration_id, npa_document_id, external_id, category, text_original,
             text_summary, article_ref, subject, confidence, detection_method, admin_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            iterationId,
            npaId,
            externalId,
            r.category || "OBL",
            r.text || "",
            r.summary || null,
            r.article_ref || null,
            r.subject || "ВСЕ",
            "high",
            "claude_analysis",
            "active",
          ]
        );
        loaded++;
      }
      console.log(`  ${loaded} requirements loaded, ${skipped} skipped (duplicates)`);
      totalLoaded += loaded;
    }

    // Stats
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM requirements WHERE admin_status = 'active') as reqs,
        (SELECT COUNT(*) FROM npa_documents) as npas
    `);

    const bySphere = await client.query(`
      SELECT n.sphere, COUNT(*) as count
      FROM requirements r
      JOIN npa_documents n ON n.id = r.npa_document_id
      GROUP BY n.sphere
      ORDER BY count DESC
    `);

    console.log(`\nDONE: ${totalLoaded} new requirements loaded`);
    console.log(`Total: ${stats.rows[0].reqs} requirements, ${stats.rows[0].npas} NPAs`);
    console.log("By sphere:");
    for (const row of bySphere.rows) {
      console.log(`  ${row.sphere}: ${row.count}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
