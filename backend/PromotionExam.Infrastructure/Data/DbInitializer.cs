using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Domain.Entities;

namespace PromotionExam.Infrastructure.Data
{
    public static class DbInitializer
    {
        public static void Initialize(ApplicationDbContext context, ICryptographyService crypto)
        {
            context.Database.EnsureCreated();
            EnsureAiMarkingSchema(context);

            // 1. Seed Users
            if (!context.SysUserRegistrations.Any())
            {
                var adminUser = new SysUserRegistration
                {
                    LoginId = "admin",
                    Password = crypto.EncryptLegacy("admin123"),
                    Name = "System Administrator",
                    Designation = "IT Head / System Admin",
                    CompanyName = "Orion Group",
                    DepartmentName = "Information Technology",
                    LocationName = "Head Office, Dhaka",
                    Email = "admin@orion-group.net",
                    Mobile = "+8801700000000",
                    IsAdmin = true,
                    IsSuperAdmin = true,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };

                var examinerUser = new SysUserRegistration
                {
                    LoginId = "examiner",
                    Password = crypto.EncryptLegacy("examiner123"),
                    Name = "Faculty Examiner",
                    Designation = "Senior Manager & Evaluator",
                    CompanyName = "Orion Pharma Ltd",
                    DepartmentName = "Quality Assurance",
                    LocationName = "Plant, Dhaka",
                    Email = "examiner@orion-group.net",
                    Mobile = "+8801800000000",
                    IsAdmin = true,
                    IsSuperAdmin = false,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };

                var examineeUser = new SysUserRegistration
                {
                    LoginId = "examinee",
                    Password = crypto.EncryptLegacy("examinee123"),
                    Name = "Mohammad Rahim",
                    Designation = "Assistant Engineer",
                    CompanyName = "Orion Power Ltd",
                    DepartmentName = "Operations & Maintenance",
                    LocationName = "Power Plant Site",
                    GradeName = "Grade-E",
                    Email = "rahim@orion-group.net",
                    Mobile = "+8801900000000",
                    IsAdmin = false,
                    IsSuperAdmin = false,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };

                context.SysUserRegistrations.AddRange(adminUser, examinerUser, examineeUser);
                context.SaveChanges();
            }

            // 2. Seed Lookup Types
            if (!context.SysLookupTypes.Any())
            {
                var typeYear = new SysLookupType { LookupType = "ExamYear", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeCompany = new SysLookupType { LookupType = "Company", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeLocation = new SysLookupType { LookupType = "Location", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeDepartment = new SysLookupType { LookupType = "Department", Serial = 4, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeSection = new SysLookupType { LookupType = "Section", Serial = 5, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeGrade = new SysLookupType { LookupType = "Grade", Serial = 6, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeConcentration = new SysLookupType { LookupType = "Concentration", Serial = 7, IsActive = true, EntryDate = DateTime.UtcNow };
                var typeQuestionSet = new SysLookupType { LookupType = "QuestionSet", Serial = 8, IsActive = true, EntryDate = DateTime.UtcNow };

                context.SysLookupTypes.AddRange(typeYear, typeCompany, typeLocation, typeDepartment, typeSection, typeGrade, typeConcentration, typeQuestionSet);
                context.SaveChanges();

                // 3. Seed Lookups
                var lookups = new List<SysLookup>
                {
                    // ExamYear
                    new SysLookup { TypeId = typeYear.TypeId, LookupText = "2024", LookupTextShort = "2024", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeYear.TypeId, LookupText = "2025", LookupTextShort = "2025", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeYear.TypeId, LookupText = "2026", LookupTextShort = "2026", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow },

                    // Company
                    new SysLookup { TypeId = typeCompany.TypeId, LookupText = "Orion Group", LookupTextShort = "OG", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeCompany.TypeId, LookupText = "Orion Pharma Ltd", LookupTextShort = "OPL", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeCompany.TypeId, LookupText = "Orion Power Dhaka Ltd", LookupTextShort = "OPDL", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeCompany.TypeId, LookupText = "Orion Infrastructure Ltd", LookupTextShort = "OIL", Serial = 4, IsActive = true, EntryDate = DateTime.UtcNow },

                    // Location
                    new SysLookup { TypeId = typeLocation.TypeId, LookupText = "Head Office, Tejgaon", LookupTextShort = "HO", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeLocation.TypeId, LookupText = "Siddhirganj Power Plant", LookupTextShort = "SPP", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeLocation.TypeId, LookupText = "Rupsha Power Plant", LookupTextShort = "RPP", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeLocation.TypeId, LookupText = "Pharma Plant, Tongi", LookupTextShort = "PPT", Serial = 4, IsActive = true, EntryDate = DateTime.UtcNow },

                    // Department
                    new SysLookup { TypeId = typeDepartment.TypeId, LookupText = "Information Technology", LookupTextShort = "IT", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeDepartment.TypeId, LookupText = "Electrical & Instrumentation", LookupTextShort = "E&I", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeDepartment.TypeId, LookupText = "Mechanical Engineering", LookupTextShort = "ME", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeDepartment.TypeId, LookupText = "Human Resources & Admin", LookupTextShort = "HR", Serial = 4, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeDepartment.TypeId, LookupText = "Finance & Accounts", LookupTextShort = "F&A", Serial = 5, IsActive = true, EntryDate = DateTime.UtcNow },

                    // Section
                    new SysLookup { TypeId = typeSection.TypeId, LookupText = "Software & Systems", LookupTextShort = "SW", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeSection.TypeId, LookupText = "Plant Operations", LookupTextShort = "OPS", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeSection.TypeId, LookupText = "Turbine Maintenance", LookupTextShort = "TM", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow },

                    // Grade
                    new SysLookup { TypeId = typeGrade.TypeId, LookupText = "Grade-C", LookupTextShort = "G-C", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeGrade.TypeId, LookupText = "Grade-D", LookupTextShort = "G-D", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeGrade.TypeId, LookupText = "Grade-E", LookupTextShort = "G-E", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeGrade.TypeId, LookupText = "Grade-F", LookupTextShort = "G-F", Serial = 4, IsActive = true, EntryDate = DateTime.UtcNow },

                    // Concentration
                    new SysLookup { TypeId = typeConcentration.TypeId, LookupText = "Renewable & Solar Energy", LookupTextShort = "SOLAR", Serial = 1, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeConcentration.TypeId, LookupText = "Thermal Power Generation", LookupTextShort = "THERMAL", Serial = 2, IsActive = true, EntryDate = DateTime.UtcNow },
                    new SysLookup { TypeId = typeConcentration.TypeId, LookupText = "Network & Infrastructure", LookupTextShort = "NET", Serial = 3, IsActive = true, EntryDate = DateTime.UtcNow }
                };

                context.SysLookups.AddRange(lookups);
                context.SaveChanges();
            }

            // 4. Seed Menus
            if (!context.SysMenus.Any())
            {
                // Parents
                var mViewer = new SysMenu { parent_id = 0, menu_name = "Viewer", target_url = null, menu_logo = "doc", color = "brown", serial_no = 1, IS_ACTIVE = true, IS_PUBLIC = true };
                var mQBank = new SysMenu { parent_id = 0, menu_name = "Question Bank", target_url = null, menu_logo = "cogwheel", color = "blue", serial_no = 2, IS_ACTIVE = true, IS_PUBLIC = true };
                var mMarking = new SysMenu { parent_id = 0, menu_name = "Marking", target_url = null, menu_logo = "notebook", color = "red", serial_no = 3, IS_ACTIVE = true, IS_PUBLIC = true };
                var mHR = new SysMenu { parent_id = 0, menu_name = "HR Panel", target_url = null, menu_logo = "users", color = "green", serial_no = 4, IS_ACTIVE = true, IS_PUBLIC = false };
                var mAdmin = new SysMenu { parent_id = 0, menu_name = "Admin", target_url = null, menu_logo = "settings", color = "gold", serial_no = 5, IS_ACTIVE = true, IS_PUBLIC = false };

                context.SysMenus.AddRange(mViewer, mQBank, mMarking, mHR, mAdmin);
                context.SaveChanges();

                // Children - Viewer
                context.SysMenus.AddRange(
                    new SysMenu { parent_id = mViewer.id, menu_name = "Search Examinee", target_url = "/viewer/search-examinee", serial_no = 1, IS_ACTIVE = true, IS_PUBLIC = true },
                    new SysMenu { parent_id = mViewer.id, menu_name = "Question Viewer", target_url = "/question-bank/viewer", serial_no = 2, IS_ACTIVE = true, IS_PUBLIC = true },
                    new SysMenu { parent_id = mViewer.id, menu_name = "Result Viewer", target_url = "/viewer/results", serial_no = 3, IS_ACTIVE = true, IS_PUBLIC = true }
                );

                // Children - Question Bank
                context.SysMenus.AddRange(
                    new SysMenu { parent_id = mQBank.id, menu_name = "Question Set", target_url = "/question-bank/sets", serial_no = 1, IS_ACTIVE = true, IS_PUBLIC = true },
                    new SysMenu { parent_id = mQBank.id, menu_name = "MCQ Question", target_url = "/question-bank/mcq", serial_no = 2, IS_ACTIVE = true, IS_PUBLIC = true },
                    new SysMenu { parent_id = mQBank.id, menu_name = "Narrative Question", target_url = "/question-bank/narrative", serial_no = 3, IS_ACTIVE = true, IS_PUBLIC = true }
                );

                // Children - Marking
                context.SysMenus.AddRange(
                    new SysMenu { parent_id = mMarking.id, menu_name = "Flow Path", target_url = "/marking/flow-path", serial_no = 1, IS_ACTIVE = true, IS_PUBLIC = true },
                    new SysMenu { parent_id = mMarking.id, menu_name = "Narrative Score", target_url = "/marking/narrative-score", serial_no = 2, IS_ACTIVE = true, IS_PUBLIC = true }
                );

                // Children - HR Panel
                context.SysMenus.AddRange(
                    new SysMenu { parent_id = mHR.id, menu_name = "Exam Batch / Pattern", target_url = "/hr/batches", serial_no = 1, IS_ACTIVE = true, IS_PUBLIC = false },
                    new SysMenu { parent_id = mHR.id, menu_name = "Registration", target_url = "/hr/registration", serial_no = 2, IS_ACTIVE = true, IS_PUBLIC = false },
                    new SysMenu { parent_id = mHR.id, menu_name = "Unregistration", target_url = "/hr/unregistration", serial_no = 3, IS_ACTIVE = true, IS_PUBLIC = false },
                    new SysMenu { parent_id = mHR.id, menu_name = "Time Editor", target_url = "/hr/time-editor", serial_no = 4, IS_ACTIVE = true, IS_PUBLIC = false }
                );

                // Children - Admin
                context.SysMenus.AddRange(
                    new SysMenu { parent_id = mAdmin.id, menu_name = "Lookup Type", target_url = "/admin/lookup-types", serial_no = 1, IS_ACTIVE = true, IS_PUBLIC = false },
                    new SysMenu { parent_id = mAdmin.id, menu_name = "Lookup", target_url = "/admin/lookups", serial_no = 2, IS_ACTIVE = true, IS_PUBLIC = false },
                    new SysMenu { parent_id = mAdmin.id, menu_name = "User Management", target_url = "/admin/users", serial_no = 3, IS_ACTIVE = true, IS_PUBLIC = false },
                    new SysMenu { parent_id = mAdmin.id, menu_name = "User Activity Audit", target_url = "/admin/activity-logs", serial_no = 4, IS_ACTIVE = true, IS_PUBLIC = false }
                );

                context.SaveChanges();
            }

            // 5. Seed Initial Question Set
            if (!context.QuestionSets.Any())
            {
                var qSet = new QuestionSet
                {
                    SetName = "Electrical & Solar Power Plant Set A",
                    DepartmentId = 2,
                    GradeId = 2,
                    LocationId = 2,
                    ConcentrationId = 1,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };
                context.QuestionSets.Add(qSet);
                context.SaveChanges();

                // Seed Sample MCQ Questions
                var mcq1 = new QuestionBank
                {
                    SetId = qSet.SetId,
                    TypeId = 1, // MCQ
                    Question = "What type of technology is typically used to implement MPPT algorithms in solar inverters?",
                    Marks = 1.0m,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };
                context.QuestionBanks.Add(mcq1);
                context.SaveChanges();

                context.QuestionBankAnswers.AddRange(
                    new QuestionBankAnswer { QuestionId = mcq1.QuestionId, AnswerDetails = "Microcontrollers & DSPs", AnswerSerial = 1, AnswerIsRight = 1, EntryDate = DateTime.UtcNow },
                    new QuestionBankAnswer { QuestionId = mcq1.QuestionId, AnswerDetails = "Relays only", AnswerSerial = 2, AnswerIsRight = 0, EntryDate = DateTime.UtcNow },
                    new QuestionBankAnswer { QuestionId = mcq1.QuestionId, AnswerDetails = "Step-up Transformers", AnswerSerial = 3, AnswerIsRight = 0, EntryDate = DateTime.UtcNow },
                    new QuestionBankAnswer { QuestionId = mcq1.QuestionId, AnswerDetails = "Chemical Batteries", AnswerSerial = 4, AnswerIsRight = 0, EntryDate = DateTime.UtcNow }
                );

                var mcq2 = new QuestionBank
                {
                    SetId = qSet.SetId,
                    TypeId = 1,
                    Question = "What is the primary function of a synchronization panel in a power generation facility?",
                    Marks = 1.0m,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };
                context.QuestionBanks.Add(mcq2);
                context.SaveChanges();

                context.QuestionBankAnswers.AddRange(
                    new QuestionBankAnswer { QuestionId = mcq2.QuestionId, AnswerDetails = "Match voltage, frequency, and phase angle before connecting to grid", AnswerSerial = 1, AnswerIsRight = 1, EntryDate = DateTime.UtcNow },
                    new QuestionBankAnswer { QuestionId = mcq2.QuestionId, AnswerDetails = "Cool the generator stator windings", AnswerSerial = 2, AnswerIsRight = 0, EntryDate = DateTime.UtcNow },
                    new QuestionBankAnswer { QuestionId = mcq2.QuestionId, AnswerDetails = "Measure fuel flow rate", AnswerSerial = 3, AnswerIsRight = 0, EntryDate = DateTime.UtcNow },
                    new QuestionBankAnswer { QuestionId = mcq2.QuestionId, AnswerDetails = "Calculate turbine exhaust temperature", AnswerSerial = 4, AnswerIsRight = 0, EntryDate = DateTime.UtcNow }
                );

                // Seed Sample Narrative Question
                var narrative1 = new QuestionBank
                {
                    SetId = qSet.SetId,
                    TypeId = 2, // Narrative
                    Question = "Explain the step-by-step startup procedure for a grid-connected solar inverter system, including safety precautions.",
                    NarrativeAnswer = "1. Inspect DC combiner box and verify string voltages.\n2. Close DC isolator switch.\n3. Turn on AC breaker.\n4. Verify grid sync parameters on control display.\n5. Confirm operational LED indicators.",
                    Marks = 10.0m,
                    IsActive = true,
                    EntryDate = DateTime.UtcNow
                };
                context.QuestionBanks.Add(narrative1);
                context.SaveChanges();

                // Seed Exam Batch
                var batch = new ExamBatch
                {
                    ExamName = "Promotion Exam 2026 - Batch 1",
                    ExamYear = 2026,
                    ExamStart = DateTime.UtcNow.AddDays(-1),
                    ExamEnd = DateTime.UtcNow.AddDays(30),
                    MCQQuestion = 20,
                    MaxMCQ = 20,
                    MCQMark = 20.0m,
                    TotalWrittenQuestion = 2,
                    WrittenMark = 20.0m,
                    TotalMark = 40.0m,
                    ExamDuration = 60,
                    IsActive = true
                };
                context.ExamBatches.Add(batch);
                context.SaveChanges();

                // Register Examinee
                var examineeUser = context.SysUserRegistrations.FirstOrDefault(u => u.LoginId == "examinee");
                if (examineeUser != null)
                {
                    var registration = new ExamRegistration
                    {
                        HRRecordId = examineeUser.HRRecordId,
                        BatchId = batch.BatchId,
                        QuestionSetId = qSet.SetId,
                        ExamGradeId = 2,
                        IsAttand = false,
                        IsExamEnd = false,
                        IsTimeExpire = false,
                        IsActive = true,
                        EntryDate = DateTime.UtcNow
                    };
                    context.ExamRegistrations.Add(registration);
                    context.SaveChanges();
                }
            }
        }

        private static void EnsureAiMarkingSchema(ApplicationDbContext context)
        {
            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'[dbo].[AI_Rubric_Master]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Question_Bank_Answer_Rebric]', N'U') IS NULL
BEGIN
    EXEC sp_rename N'[dbo].[AI_Rubric_Master]', N'Question_Bank_Answer_Rebric';
END
IF OBJECT_ID(N'[dbo].[Question_Bank_Answer_Rebric]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Question_Bank_Answer_Rebric](
        [RubricMasterId] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [QuestionId] [int] NOT NULL,
        [VersionNo] [int] NOT NULL,
        [RubricHash] [nvarchar](128) NOT NULL,
        [QuestionSnapshot] [nvarchar](max) NOT NULL,
        [StandardAnswerSnapshot] [nvarchar](max) NULL,
        [SubjectSnapshot] [nvarchar](500) NULL,
        [MaxMarks] [decimal](18,2) NOT NULL,
        [RubricSummary] [nvarchar](max) NULL,
        [CriteriaJson] [nvarchar](max) NULL,
        [SourceModel] [nvarchar](100) NULL,
        [PromptVersion] [nvarchar](50) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_Question_Bank_Answer_Rebric_IsActive] DEFAULT(1),
        [GeneratedBy] [bigint] NULL,
        [EntryDate] [datetime2] NULL,
        [UpdateDate] [datetime2] NULL,
        CONSTRAINT [FK_Question_Bank_Answer_Rebric_Question_Bank] FOREIGN KEY([QuestionId]) REFERENCES [dbo].[Question_Bank]([QuestionId])
    );
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Question_Bank_Answer_Rebric_QuestionId_VersionNo' AND object_id = OBJECT_ID(N'[dbo].[Question_Bank_Answer_Rebric]'))
BEGIN
    CREATE UNIQUE INDEX [UX_Question_Bank_Answer_Rebric_QuestionId_VersionNo] ON [dbo].[Question_Bank_Answer_Rebric]([QuestionId], [VersionNo]);
END
IF COL_LENGTH(N'[dbo].[Question_Bank_Answer_Rebric]', 'CriteriaJson') IS NULL
BEGIN
    ALTER TABLE [dbo].[Question_Bank_Answer_Rebric] ADD [CriteriaJson] [nvarchar](max) NULL;
END
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'[dbo].[Exam_Narrative_AI_Evaluation]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Exam_Narrative_AI_Evaluation](
        [AiEvaluationId] [bigint] IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [ExamineeId] [int] NOT NULL,
        [QuestionId] [int] NOT NULL,
        [RubricMasterId] [int] NOT NULL,
        [StudentAnswerSnapshot] [nvarchar](max) NULL,
        [AwardedMarks] [decimal](18,2) NOT NULL,
        [Confidence] [decimal](5,4) NULL,
        [Summary] [nvarchar](max) NULL,
        [StrengthsJson] [nvarchar](max) NULL,
        [MissingPointsJson] [nvarchar](max) NULL,
        [IncorrectPointsJson] [nvarchar](max) NULL,
        [CriterionBreakdownJson] [nvarchar](max) NULL,
        [ValidationStatus] [nvarchar](50) NOT NULL,
        [ValidationNotes] [nvarchar](max) NULL,
        [ReviewRecommended] [bit] NOT NULL CONSTRAINT [DF_Exam_Narrative_AI_Evaluation_ReviewRecommended] DEFAULT(0),
        [SourceModel] [nvarchar](100) NULL,
        [PromptVersion] [nvarchar](50) NULL,
        [RequestedBy] [bigint] NULL,
        [EntryDate] [datetime2] NULL,
        [UpdateDate] [datetime2] NULL,
        CONSTRAINT [FK_Exam_Narrative_AI_Evaluation_Question_Bank] FOREIGN KEY([QuestionId]) REFERENCES [dbo].[Question_Bank]([QuestionId]),
        CONSTRAINT [FK_Exam_Narrative_AI_Evaluation_Question_Bank_Answer_Rebric] FOREIGN KEY([RubricMasterId]) REFERENCES [dbo].[Question_Bank_Answer_Rebric]([RubricMasterId])
    );
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Exam_Narrative_AI_Evaluation_Examinee_Question_Rubric' AND object_id = OBJECT_ID(N'[dbo].[Exam_Narrative_AI_Evaluation]'))
BEGIN
    CREATE UNIQUE INDEX [UX_Exam_Narrative_AI_Evaluation_Examinee_Question_Rubric] ON [dbo].[Exam_Narrative_AI_Evaluation]([ExamineeId], [QuestionId], [RubricMasterId]);
END
");
        }
    }
}
