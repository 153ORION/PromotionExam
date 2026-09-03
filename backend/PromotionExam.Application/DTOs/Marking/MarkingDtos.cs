using System;
using System.Collections.Generic;

namespace PromotionExam.Application.DTOs.Marking
{
    public class NarrativeCandidateDto
    {
        public int ExamineeId { get; set; }
        public string LoginId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Designation { get; set; }
        public string? DepartmentName { get; set; }
        public int BatchId { get; set; }
        public int QuestionSetId { get; set; }
        public bool IsEvaluated { get; set; }
        public bool IsEvaluatedByMe { get; set; }
        public int ExaminersCount { get; set; }
        public decimal? CurrentNarrativeScore { get; set; }
        public decimal? MyNarrativeScore { get; set; }
        public decimal? AvgNarrativeScore { get; set; }
        public bool IsFinalized { get; set; }
        public string? FinalApproverName { get; set; }
        public decimal? FinalApproverScore { get; set; }
    }

    public class ExaminerScorePreviewDto
    {
        public long ScoreId { get; set; }
        public long ExaminerId { get; set; }
        public string ExaminerName { get; set; } = string.Empty;
        public string? Designation { get; set; }
        public string? DepartmentName { get; set; }
        public string Role { get; set; } = "Evaluator";
        public int Rank { get; set; } = 1;
        public bool IsApprover { get; set; }
        public decimal Marks { get; set; }
        public string? Remarks { get; set; }
        public DateTime? EntryDate { get; set; }
        public string? FormattedDate { get; set; }
        public bool IsCurrentExaminer { get; set; }
    }

    public class CandidateNarrativeQuestionDto
    {
        public int QuestionId { get; set; }
        public string Question { get; set; } = string.Empty;
        public string? ModelAnswer { get; set; }
        public decimal MaxMarks { get; set; }
        public string? CandidateAnswer { get; set; }
        public decimal? MyMarks { get; set; }
        public string? MyRemarks { get; set; }
        public decimal? AvgMarks { get; set; }
        public int ScoredExaminerCount { get; set; }
        public List<ExaminerScorePreviewDto> ExaminerScores { get; set; } = new();
        public bool IsFinalized { get; set; }
        public bool CanEdit { get; set; } = true;
        public string? FinalApproverName { get; set; }
        public bool IsCurrentExaminerApprover { get; set; }

        // Kept for backward compatibility
        public decimal? AwardedMarks { get; set; }
        public string? Remarks { get; set; }
    }

    public class SubmitNarrativeScoreDto
    {
        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public decimal Marks { get; set; }
        public string? Remarks { get; set; }
    }

    public class QuestionScoreItemDto
    {
        public int QuestionId { get; set; }
        public decimal Marks { get; set; }
        public string? Remarks { get; set; }
    }

    public class SubmitAllNarrativeScoresDto
    {
        public int ExamineeId { get; set; }
        public List<QuestionScoreItemDto> Scores { get; set; } = new();
    }

    public class ExamineeResultSummaryDto
    {
        public int ExamineeId { get; set; }
        public string LoginId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Designation { get; set; }
        public string? DepartmentName { get; set; }
        public string? CompanyName { get; set; }
        public string? LocationName { get; set; }
        public string? GradeName { get; set; }
        public string? BatchName { get; set; }
        public string? SetName { get; set; }
        public decimal MCQScore { get; set; }
        public decimal WrittenScore { get; set; }
        public decimal TotalScore { get; set; }
        public decimal TotalPossibleMarks { get; set; }
        public bool IsPassed { get; set; }
        public bool IsAttended { get; set; }
        public DateTime? ExamDate { get; set; }
    }
}
