import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const category = url.searchParams.get("category");
  const npaId = url.searchParams.get("npa_id");
  const status = url.searchParams.get("status") || "active";
  const voteStatus = url.searchParams.get("vote_status"); // voted | unvoted | all
  const offset = (page - 1) * limit;

  let where = "WHERE r.admin_status = $1";
  const params: unknown[] = [status];
  let paramIdx = 2;

  if (category) {
    where += ` AND r.category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }
  if (npaId) {
    where += ` AND r.npa_document_id = $${paramIdx}`;
    params.push(parseInt(npaId));
    paramIdx++;
  }

  // Подзапрос для текущего голоса пользователя
  const voteJoin = `
    LEFT JOIN expert_votes v ON v.requirement_id = r.id
      AND v.user_id = ${user.id}
      AND v.iteration_id = r.iteration_id
  `;

  if (voteStatus === "unvoted") {
    where += " AND v.id IS NULL";
  } else if (voteStatus === "voted") {
    where += " AND v.id IS NOT NULL";
  }

  // Общее количество
  const countResult = await query(
    `SELECT COUNT(*) FROM requirements r ${voteJoin} ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Данные
  const result = await query(
    `SELECT r.id, r.external_id, r.category, r.text_original, r.text_summary,
            r.article_ref, r.subject, r.expert_category, r.confidence,
            r.detection_method, r.admin_status, r.gold_standard_title,
            n.title as npa_title, n.code as npa_code,
            v.vote as my_vote, v.comment as my_comment,
            (SELECT COUNT(*) FROM expert_votes WHERE requirement_id = r.id AND iteration_id = r.iteration_id AND vote = 'confirm') as confirms,
            (SELECT COUNT(*) FROM expert_votes WHERE requirement_id = r.id AND iteration_id = r.iteration_id AND vote = 'reject') as rejects,
            (SELECT COUNT(*) FROM expert_votes WHERE requirement_id = r.id AND iteration_id = r.iteration_id) as total_votes
     FROM requirements r
     LEFT JOIN npa_documents n ON n.id = r.npa_document_id
     ${voteJoin}
     ${where}
     ORDER BY r.id
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  return NextResponse.json({
    requirements: result.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
