import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { asTransactionSql, getSql } from "../src/lib/db";

async function main() {
  const pool = getSql();
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await pool`
    INSERT INTO "Department" (id, name) VALUES ('seed-dept', 'Кафедра терапии')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;
  await pool`
    INSERT INTO "Faculty" (id, name) VALUES ('seed-fac', 'Лечебное дело')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;
  await pool`
    INSERT INTO "CourseLevel" (id, name, sort) VALUES ('seed-course', '4 курс', 4)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort = EXCLUDED.sort
  `;

  await pool`
    INSERT INTO "User" (id, login, "passwordHash", name, role, "departmentId")
    VALUES (
      ${randomUUID()},
      'admin',
      ${passwordHash},
      'Администратор',
      'ADMIN',
      'seed-dept'
    )
    ON CONFLICT (login) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"
  `;

  await pool`
    INSERT INTO "User" (id, login, "passwordHash", name, role, "departmentId")
    VALUES (
      ${randomUUID()},
      'teacher',
      ${passwordHash},
      'Преподаватель Иванова',
      'TEACHER',
      'seed-dept'
    )
    ON CONFLICT (login) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"
  `;

  await pool`
    INSERT INTO "StudyGroup" (id, name, "facultyId", "courseLevelId")
    VALUES ('seed-group', 'Группа 401', 'seed-fac', 'seed-course')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      "facultyId" = EXCLUDED."facultyId",
      "courseLevelId" = EXCLUDED."courseLevelId"
  `;

  const existing = await pool<{ id: string }[]>`
    SELECT id FROM "Case" WHERE title = 'Демо: одышка и лихорадка' LIMIT 1
  `;
  if (existing[0]) {
    console.log("Seed OK (демо-кейс уже есть).");
    await pool.end({ timeout: 5 });
    return;
  }

  const caseId = randomUUID();
  await pool.begin(async (txn) => {
    const sql = asTransactionSql(pool, txn);
    await sql`
      INSERT INTO "Case" (id, title, description, published, "teacherKey", "caseVersion", "departmentId")
      VALUES (
        ${caseId},
        'Демо: одышка и лихорадка',
        'Вымышленный клинический случай для проверки платформы.',
        true,
        'Эталон: внебольничная пневмония справа. Критерии: кашель, лихорадка, локальные крепитации, инфильтрат на ОГК.',
        1,
        'seed-dept'
      )
    `;
    await sql`
      INSERT INTO "CaseFaculty" ("caseId", "facultyId") VALUES (${caseId}, 'seed-fac')
    `;
    await sql`
      INSERT INTO "CaseCourseLevel" ("caseId", "courseLevelId") VALUES (${caseId}, 'seed-course')
    `;

    const st1 = randomUUID();
    const st2 = randomUUID();
    const st3 = randomUUID();
    await sql`
      INSERT INTO "CaseStage" (id, "caseId", "order", title, "isFinalReveal", "learningGoals")
      VALUES
        (${st1}, ${caseId}, 1, 'Жалобы и анамнез', false, 'Собрать анамнез респираторной симптоматики.'),
        (${st2}, ${caseId}, 2, 'Объективно и лабораторно', false, NULL),
        (${st3}, ${caseId}, 3, 'Итог и разбор', true, NULL)
    `;

    await sql`
      INSERT INTO "StageBlock" (id, "caseStageId", "order", "blockType", "rawText", "formattedContent", "imageUrl", "imageAlt")
      VALUES
        (${randomUUID()}, ${st1}, 0, 'PATIENT_SPEECH',
          'Доктор, третий день температура до 38.5, кашель с мокротой желтоватой, больно дышать справа внизу груди.',
          NULL, NULL, NULL),
        (${randomUUID()}, ${st1}, 1, 'DOCTOR_NOTES',
          'Состояние средней тяжести. Справа внизу ослабленное везикулярное дыхание, мелкопузырчатые крепитации.',
          NULL, NULL, NULL),
        (${randomUUID()}, ${st2}, 0, 'DOCTOR_NOTES',
          'ЧДД 22. SpO2 94% на воздухе. Анализ крови: лейкоцитоз 14, СРБ повышен. Рентген: инфильтративное затемнение в нижней доле справа.',
          NULL, NULL, NULL),
        (${randomUUID()}, ${st2}, 1, 'IMAGE_URL', NULL, NULL,
          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/X-ray_of_pneumonia.jpg/440px-X-ray_of_pneumonia.jpg',
          'Пример рентгенограммы (иллюстративное фото)'),
        (${randomUUID()}, ${st3}, 0, 'NARRATOR',
          'Пациенту была назначена антибактериальная терапия амбулаторно с контролем через 48–72 часа. Диагноз: внебольничная пневмония нижней доли справа.',
          NULL, NULL, NULL)
    `;
  });

  console.log("Seed OK.");
  await pool.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error(e);
  try {
    await getSql().end({ timeout: 2 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
