using System;
using System.Collections.Generic;

namespace PromotionExam.Application.DTOs.Marking
{
    public class AiRubricCriterionDto
    {
        public int RubricDetailId { get; set; }
        public string CriterionTitle { get; set; } = string.Empty;
        public string ExpectedConcept { get; set; } = string.Empty;
        public string? ScoringGuidance { get; set; }
        public decimal MaxMarks { get; set; }
        public int SortOrder { get; set; }
        public List<string> Keywords { get; set; } = new();
        public List<string> CommonMistakes { get; set; } = new();
    }

    public class AiRubricDto
    {
        public int RubricMasterId { get; set; }
        public int QuestionId { get; set; }
        public int VersionNo { get; set; }
        public string Status { get; set; } = "NotGenerated";
        public bool IsActive { get; set; }
        public bool NeedsRegeneration { get; set; }
        public string? SubjectSnapshot { get; set; }
        public decimal MaxMarks { get; set; }
        public string? RubricSummary { get; set; }
        public string? SourceModel { get; set; }
        public string? PromptVersion { get; set; }
        public DateTime? EntryDate { get; set; }
        public int CriteriaCount { get; set; }
        public List<AiRubricCriterionDto> Criteria { get; set; } = new();
    }

    public class AiEvaluationCriterionDto
    {
        public int RubricDetailId { get; set; }
        public string CriterionTitle { get; set; } = string.Empty;
        public decimal AwardedMarks { get; set; }
        public decimal MaxMarks { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class AiNarrativeEvaluationDto
    {
        public long AiEvaluationId { get; set; }
        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public int RubricMasterId { get; set; }
        public int RubricVersionNo { get; set; }
        public decimal AwardedMarks { get; set; }
        public decimal MaxMarks { get; set; }
        public decimal Confidence { get; set; }
        public string? Summary { get; set; }
        public List<string> Strengths { get; set; } = new();
        public List<string> MissingPoints { get; set; } = new();
        public List<string> IncorrectPoints { get; set; } = new();
        public List<AiEvaluationCriterionDto> CriterionBreakdown { get; set; } = new();
        public string ValidationStatus { get; set; } = "Validated";
        public string? ValidationNotes { get; set; }
        public bool ReviewRecommended { get; set; }
        public string? SourceModel { get; set; }
        public string? PromptVersion { get; set; }
        public DateTime? EntryDate { get; set; }
        public bool IsCached { get; set; }
        public bool IsValidSuggestion => ValidationStatus == "Validated" || ValidationStatus == "Flagged";
    }

    public class GenerateAiRubricResponseDto
    {
        public string Message { get; set; } = string.Empty;
        public AiRubricDto Rubric { get; set; } = new();
    }

    public class EvaluateAiNarrativeRequestDto
    {
        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public bool ForceReevaluate { get; set; }
    }

    public class AutoMarkExamineeRequestDto
    {
        public bool ForceReevaluate { get; set; } = false;
        public bool AutoApplyScores { get; set; } = true;
    }

    public class QuestionAutoMarkItemDto
    {
        public int QuestionId { get; set; }
        public string Question { get; set; } = string.Empty;
        public decimal MaxMarks { get; set; }
        public decimal AwardedMarks { get; set; }
        public string Status { get; set; } = string.Empty; // "Evaluated", "RubricGeneratedAndEvaluated", "EmptyAnswer", "Error"
        public string? Remarks { get; set; }
        public AiNarrativeEvaluationDto? Evaluation { get; set; }
    }

    public class AutoMarkExamineeResultDto
    {
        public int ExamineeId { get; set; }
        public string ExamineeName { get; set; } = string.Empty;
        public string LoginId { get; set; } = string.Empty;
        public int TotalQuestions { get; set; }
        public int EvaluatedCount { get; set; }
        public int SkippedCount { get; set; }
        public decimal TotalAwardedMarks { get; set; }
        public decimal TotalMaxMarks { get; set; }
        public bool ScoresApplied { get; set; }
        public decimal? TotalWrittenScore { get; set; }
        public List<QuestionAutoMarkItemDto> Questions { get; set; } = new();
        public string Message { get; set; } = string.Empty;
    }

    public class GenerateStandardAnswerResponseDto
    {
        public int QuestionId { get; set; }
        public string StandardAnswer { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
