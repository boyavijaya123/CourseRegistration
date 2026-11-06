
const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const PORT = 3000;

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ================= MYSQL CONNECTION =================
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD || "1965490219",
    database: "college_db"
});

db.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }
    console.log("Connected to MySQL successfully!");
});

// ================= HOME PAGE =================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= VIEW ALL COURSES =================
app.get("/api/courses", (req, res) => {
    db.query(
        "SELECT * FROM courses ORDER BY course_id",
        (err, results) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to load courses."
                });
            }

            res.json(results);
        }
    );
});

// ================= VIEW ONE COURSE =================
app.get("/api/courses/:id", (req, res) => {
    db.query(
        "SELECT * FROM courses WHERE course_id = ?",
        [req.params.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Unable to retrieve course."
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            res.json(results[0]);
        }
    );
});

// ================= ADD COURSE =================
app.post("/api/courses", (req, res) => {
    const {
        course_code,
        course_name,
        course_credits,
        department,
        semester
    } = req.body;

    const code = String(course_code || "").trim();
    const name = String(course_name || "").trim();
    const dept = String(department || "").trim();
    const credits = Number(course_credits);
    const sem = Number(semester);

    if (
        !code ||
        !name ||
        !dept ||
        !Number.isInteger(credits) ||
        credits < 1 ||
        credits > 10 ||
        !Number.isInteger(sem) ||
        sem < 1 ||
        sem > 12
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter valid course details."
        });
    }

    const sql = `
        INSERT INTO courses
        (course_code, course_name, course_credits, department, semester)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [code, name, credits, dept, sem],
        (err, result) => {
            if (err) {
                console.error("Add course error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: err.code === "ER_DUP_ENTRY"
                        ? "Course code already exists."
                        : "Could not add course."
                });
            }

            res.status(201).json({
                success: true,
                message: "Course added successfully!",
                course_id: result.insertId
            });
        }
    );
});

// ================= UPDATE COURSE =================
app.put("/api/courses/:id", (req, res) => {
    const {
        course_code,
        course_name,
        course_credits,
        department,
        semester
    } = req.body;

    const code = String(course_code || "").trim();
    const name = String(course_name || "").trim();
    const dept = String(department || "").trim();
    const credits = Number(course_credits);
    const sem = Number(semester);

    if (
        !code ||
        !name ||
        !dept ||
        !Number.isInteger(credits) ||
        credits < 1 ||
        credits > 10 ||
        !Number.isInteger(sem) ||
        sem < 1 ||
        sem > 12
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter valid course details."
        });
    }

    const sql = `
        UPDATE courses
        SET course_code = ?,
            course_name = ?,
            course_credits = ?,
            department = ?,
            semester = ?
        WHERE course_id = ?
    `;

    db.query(
        sql,
        [code, name, credits, dept, sem, req.params.id],
        (err, result) => {
            if (err) {
                console.error("Update error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not update course."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            res.json({
                success: true,
                message: "Course updated successfully!"
            });
        }
    );
});

// ================= DELETE COURSE =================
app.delete("/api/courses/:id", (req, res) => {
    db.query(
        "DELETE FROM courses WHERE course_id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                console.error("Delete error:", err.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not delete course. Check whether registrations reference it."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            res.json({
                success: true,
                message: "Course deleted successfully!"
            });
        }
    );
});

// ================= STUDENT REGISTRATION =================
// Supports both endpoint URLs for compatibility with existing pages.
app.post(
    ["/api/registrations", "/api/register"],
    (req, res) => {
        const fullName = String(
            req.body.fullName ||
            req.body.full_name ||
            req.body.student_name ||
            ""
        ).trim();

        const rollNumber = String(
            req.body.rollNumber ||
            req.body.roll_number ||
            ""
        ).trim();

        const email = String(req.body.email || "").trim();

        const rawCourseId =
            req.body.courseId ?? req.body.course_id;

        const courseId = Number(rawCourseId);

        if (
            !fullName ||
            !rollNumber ||
            !email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            rawCourseId === undefined ||
            rawCourseId === null ||
            String(rawCourseId).trim() === "" ||
            !Number.isInteger(courseId) ||
            courseId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name, roll number, email, and course."
            });
        }

        // Check that the selected course exists.
        db.query(
            "SELECT course_id FROM courses WHERE course_id = ?",
            [courseId],
            (checkError, courses) => {
                if (checkError) {
                    console.error(
                        "Course check error:",
                        checkError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Could not verify selected course."
                    });
                }

                if (courses.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Selected course does not exist. Refresh the course list."
                    });
                }

                const sql = `
                    INSERT INTO registrations
                    (full_name, roll_number, email, course_id)
                    VALUES (?, ?, ?, ?)
                `;

                db.query(
                    sql,
                    [fullName, rollNumber, email, courseId],
                    (err, result) => {
                        if (err) {
                            console.error(
                                "Registration error:",
                                err.message
                            );

                            return res.status(500).json({
                                success: false,
                                message: "Registration failed. Check the registrations table columns."
                            });
                        }

                        res.status(201).json({
                            success: true,
                            message: "Student registered successfully!",
                            registration_id: result.insertId
                        });
                    }
                );
            }
        );
    }
);

// ================= VIEW ALL REGISTRATIONS =================
app.get("/api/registrations", (req, res) => {
    const sql = `
        SELECT
            r.registration_id,
            r.full_name,
            r.roll_number,
            r.email,
            r.course_id,
            r.registered_at,
            c.course_code,
            c.course_name
        FROM registrations r
        LEFT JOIN courses c
            ON r.course_id = c.course_id
        ORDER BY r.registration_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(
                "Get registrations error:",
                err.message
            );

            return res.status(500).json({
                success: false,
                message: "Unable to load registrations."
            });
        }

        res.json(results);
    });
});

// ================= UNKNOWN API ROUTES =================
// This must remain AFTER all API routes.
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message:
            "API endpoint not found: " +
            req.method + " " + req.originalUrl
    });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (req.originalUrl.startsWith("/api/")) {
        return res.status(500).json({
            success: false,
            message: "An unexpected server error occurred."
        });
    }

    res.status(500).send(
        "An unexpected server error occurred."
    );
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(
        `Server running at http://localhost:${PORT}`
    );
});
