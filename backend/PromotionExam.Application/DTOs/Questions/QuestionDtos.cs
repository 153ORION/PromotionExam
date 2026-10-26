using System;
using System.Collections.Generic;
using PromotionExam.Application.DTOs.Marking;

namespace PromotionExam.Application.DTOs.Questions
{
    public class QuestionSetDto
    {
        public int SetId { get; set; }
        public string SetName { get; set; } = string.Empty;
        public int? LocationId { get; set; }
        public string? LocationName { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int? GradeId { get; set; }
        public string? GradeName { get; set; }
        public int? ConcentrationId { get; set; }
        public string? ConcentrationName { get; set; }
        public bool? IsActive { get; set; }
        public int QuestionCount { get; set; }
        public DateTime? EntryDate { get; set; }
    }

    public class QuestionSetCreateUpdateDto
    {
        public int? SetId { get; set; }
        public string SetName { get; set; } = string.Empty;
        public int? LocationId { get; set; }
        public int? DepartmentId { get; set; }
        public int? GradeId { get; set; }
        public int? ConcentrationId { get; set; }
    }

    // Question Sets > Sync: bank questions (Bulk_Questions_Excel) that match a set but are not in it yet.
    public class SetSyncCandidatesDto
    {
        public int SetId { get; set; }
        public string SetName { get; set; } = string.Empty;
        // Matching questions left out because they still need fixing (errors or disputed Type/Part).
        public int NeedsFixingCount { get; set; }
        public List<BulkQuestionRowDto> Questions { get; set; } = new();
    }

    public class SetSyncRequestDto
    {
        public List<long> BulkQuestionIds { get; set; } = new();
        // Marks given to each synced question of that type (Question_Bank.Marks).
        public decimal McqMarks { get; set; }
        public decimal DescriptiveMarks { get; set; }
    }

    public class SetSyncResultDto
    {
        public int Synced { get; set; }
        // Selected questions not added: already in the set, no longer matching, or repeating another selected question.
        public int Skipped { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class QuestionBankDto
    {
        public int QuestionId { get; set; }
        public int SetId { get; set; }
        public string? SetName { get; set; }
        public int TypeId { get; set; } // 1 = MCQ, 2 = Narrative
        public string QuestionType => TypeId == 1 ? "MCQ" : "Narrative";
        public string Question { get; set; } = string.Empty;
        public string? NarrativeAnswer { get; set; }
        public decimal Marks { get; set; }
        public bool? IsActive { get; set; }
        public DateTime? EntryDate { get; set; }
        public string? AiRubricStatus { get; set; }
        public int? AiRubricVersionNo { get; set; }
        public bool AiRubricNeedsRegeneration { get; set; }
        public int AiRubricCriteriaCount { get; set; }
        public string? AiRubricSummary { get; set; }
        public DateTime? AiRubricGeneratedAt { get; set; }
        public List<QuestionOptionDto> Answers { get; set; } = new();
    }

    public class QuestionOptionDto
    {
        public int? AnswerId { get; set; }
        public string AnswerDetails { get; set; } = string.Empty;
        public int AnswerSerial { get; set; }
        public bool IsRight { get; set; }
    }

    public class QuestionCreateUpdateDto
    {
        public int? QuestionId { get; set; }
        public int SetId { get; set; }
        public int TypeId { get; set; } // 1 = MCQ, 2 = Narrative
        public string Question { get; set; } = string.Empty;
        public string? NarrativeAnswer { get; set; }
        public decimal Marks { get; set; }
        public List<QuestionOptionDto> Options { get; set; } = new();
    }

    public class RubricViewerQuestionDto
    {
        public int QuestionId { get; set; }
        public string Question { get; set; } = string.Empty;
        public decimal Marks { get; set; }
        public string? NarrativeAnswer { get; set; }
        public string RubricStatus { get; set; } = "NotGenerated"; // Ready | Outdated | NotGenerated
        public int? RubricVersionNo { get; set; }
        public string? RubricSummary { get; set; }
        public string? RubricSourceModel { get; set; }
        public DateTime? RubricGeneratedAt { get; set; }
        public List<AiRubricCriterionDto> Criteria { get; set; } = new();
    }

    public class RubricViewerResponseDto
    {
        public int SetId { get; set; }
        public string SetName { get; set; } = string.Empty;
        public int TotalQuestions { get; set; }
        public List<RubricViewerQuestionDto> Questions { get; set; } = new();
    }
}
