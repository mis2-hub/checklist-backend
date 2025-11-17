import pool from "../config/db.js";
import { uploadToS3 } from "../middleware/s3Upload.js";


/* ------------------------------------------------------
   FETCH PENDING + EXTEND TASKS (delegation)
------------------------------------------------------ */
export const fetchDelegationDataSortByDate = async (req, res) => {
  const role = req.query.role;
  const username = req.query.username;

  try {
    let query = "";

    console.log("PARAMS →", req.query);

    // USER: only own pending
    if (role === "user") {
      query = `
        SELECT *
        FROM delegation
        WHERE name = '${username}'
        AND (status IS NULL OR status = '' OR status = 'extend' OR status = 'pending')
        ORDER BY task_start_date ASC;
      `;
    }

    // ADMIN: fetch ALL pending tasks (ignore user_access)
    else if (role === "admin") {
      query = `
        SELECT *
        FROM delegation
        WHERE (status IS NULL OR status = '' OR status = 'extend' OR status = 'pending')
        ORDER BY task_start_date ASC;
      `;
    }

    // NO ROLE (fallback)
    else {
      query = `
        SELECT *
        FROM delegation
        ORDER BY task_start_date ASC;
      `;
    }

    console.log("FINAL QUERY →", query);

    const { rows } = await pool.query(query);
    return res.json(rows);

  } catch (err) {
    console.log("Pending fetch error:", err);
    return res.status(400).json({ error: err.message });
  }
};


/* ------------------------------------------------------
   FETCH DONE TASKS (delegation_done)
------------------------------------------------------ */
export const fetchDelegation_DoneDataSortByDate = async (req, res) => {
  const role = req.query.role;
  const username = req.query.username;
  const userAccess = req.query.user_access;

  try {
    let query = `
      SELECT *
      FROM delegation_done
      ORDER BY created_at DESC;
    `;

    // USER LEVEL FILTER
    if (role === "user") {
      query = `
        SELECT *
        FROM delegation_done
        WHERE name = '${username}'
        ORDER BY created_at DESC;
      `;
    }

    // ADMIN FILTER — ONLY IF YOU ADD department COLUMN IN delegation_done
    if (role === "admin" && userAccess) {
      const depts = userAccess
        .replace(/\+/g, " ")
        .split(",")
        .map((d) => `'${d.trim().toLowerCase()}'`)
        .join(",");

      // Check if department column exists
      query = `
        SELECT *
        FROM delegation_done
        ORDER BY created_at DESC;
      `;
    }

    const { rows } = await pool.query(query);
    return res.json(rows);
  } catch (err) {
    console.log("Done fetch error:", err);
    return res.status(400).json({ error: err.message });
  }
};

/* ------------------------------------------------------
  INSERT INTO delegation_done AND UPDATE delegation
------------------------------------------------------ */
// export const insertDelegationDoneAndUpdate = async (req, res) => {
//   try {
//     console.log("REQ BODY 👉", req.body);

//     const selectedDataArray = req.body.selectedData;

//     if (!selectedDataArray || !Array.isArray(selectedDataArray)) {
//       return res.status(400).json({ error: "selectedData missing or invalid" });
//     }

//     const client = await pool.connect();
//     const results = [];

//     for (const task of selectedDataArray) {
      
//       const statusForDone =
//         task.status === "done"
//           ? "completed"
//           : task.status === "extend"
//           ? "extend"
//           : "in_progress";

//       const statusForDelegation =
//         task.status === "done"
//           ? "done"
//           : task.status === "extend"
//           ? "extend"
//           : null;

//       /* INSERT INTO delegation_done WITHOUT department */
//       const insertQuery = `
//         INSERT INTO delegation_done
//         (task_id, status, next_extend_date, reason, image_url, name, task_description, given_by)
//         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
//         RETURNING *;
//       `;

//       const insertValues = [
//         task.task_id,
//         statusForDone,
//         task.next_extend_date || null,
//         task.reason || "",
//         task.image_url || null,
//         task.name,
//         task.task_description,
//         task.given_by
//       ];

//       const inserted = await client.query(insertQuery, insertValues);

//       /* UPDATE delegation */
//       const updateQuery = `
//         UPDATE delegation
//         SET status = $1,
//             submission_date = NOW(),
//             updated_at = NOW(),
//             remarks = $2,
//             planned_date = $3
//         WHERE task_id = $4
//         RETURNING *;
//       `;

//       const updateValues = [
//         statusForDelegation,
//         task.reason || "",
//         task.next_extend_date || task.planned_date,
//         task.task_id
//       ];

//       const updated = await client.query(updateQuery, updateValues);

//       results.push({
//         done: inserted.rows[0],
//         updated: updated.rows[0]
//       });
//     }

//     return res.json(results);

//   } catch (err) {
//     console.error("Insert error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// };


export const insertDelegationDoneAndUpdate = async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log("🔄 REQ BODY received:", JSON.stringify(req.body, null, 2));

    const selectedDataArray = req.body.selectedData;

    if (!selectedDataArray || !Array.isArray(selectedDataArray)) {
      return res.status(400).json({ error: "selectedData missing or invalid" });
    }

    await client.query("BEGIN");
    const results = [];

    for (const task of selectedDataArray) {
      console.log(`🔄 Processing task ${task.task_id}:`, {
        hasImageBase64: !!task.image_base64,
        imageLength: task.image_base64 ? task.image_base64.length : 0,
        imageStartsWithData: task.image_base64 ? task.image_base64.startsWith('data:image') : false
      });

      const statusForDone =
        task.status === "done"
          ? "completed"
          : task.status === "extend"
          ? "extend"
          : "in_progress";

      const statusForDelegation =
        task.status === "done"
          ? "done"
          : task.status === "extend"
          ? "extend"
          : null;

      // 🔥 DEBUG: Handle image upload from base64
      let finalImageUrl = null;

      if (task.image_base64 && typeof task.image_base64 === "string") {
        try {
          if (task.image_base64.startsWith("data:image")) {
            console.log(`📸 Processing base64 image for task ${task.task_id}`);
            
            const base64Data = task.image_base64.split(";base64,").pop();
            const buffer = Buffer.from(base64Data, "base64");

            console.log(`📊 Image buffer size: ${buffer.length} bytes`);

            const fakeFile = {
              originalname: `delegation_${task.task_id}_${Date.now()}.jpg`,
              buffer,
              mimetype: "image/jpeg",
            };

            // Upload to S3
            console.log(`🚀 Uploading to S3 for task ${task.task_id}...`);
            finalImageUrl = await uploadToS3(fakeFile);
            console.log(`✅ S3 Upload successful: ${finalImageUrl}`);
          } else {
            // Already S3 URL or old string
            console.log(`ℹ️ Using existing image URL for task ${task.task_id}`);
            finalImageUrl = task.image_base64;
          }
        } catch (imageError) {
          console.error(`❌ Image processing failed for task ${task.task_id}:`, imageError);
          // Continue without image rather than failing the entire request
          finalImageUrl = null;
        }
      } else {
        console.log(`❌ No image_base64 found for task ${task.task_id}`);
      }

      console.log(`📝 Final image URL for task ${task.task_id}:`, finalImageUrl);

      /* INSERT INTO delegation_done */
      const insertQuery = `
        INSERT INTO delegation_done
        (task_id, status, next_extend_date, reason, image_url, name, task_description, given_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *;
      `;

      const insertValues = [
        task.task_id,
        statusForDone,
        task.next_extend_date || null,
        task.reason || "",
        finalImageUrl,
        task.name,
        task.task_description,
        task.given_by
      ];

      console.log(`💾 Inserting into delegation_done:`, insertValues);
      const inserted = await client.query(insertQuery, insertValues);

      /* UPDATE delegation */
      const updateQuery = `
        UPDATE delegation
        SET status = $1,
            submission_date = NOW(),
            updated_at = NOW(),
            remarks = $2,
            planned_date = $3,
            image = $4
        WHERE task_id = $5
        RETURNING *;
      `;

      const updateValues = [
        statusForDelegation,
        task.reason || "",
        task.next_extend_date || task.planned_date,
        finalImageUrl,
        task.task_id
      ];

      console.log(`💾 Updating delegation:`, updateValues);
      const updated = await client.query(updateQuery, updateValues);

      results.push({
        done: inserted.rows[0],
        updated: updated.rows[0]
      });
    }

    await client.query("COMMIT");
    console.log("✅ All tasks processed successfully");
    return res.json(results);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Insert error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

