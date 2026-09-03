using System;
using System.Collections.Generic;
using System.Net;

namespace PromotionExam.Application.DTOs.CandidateAttempt
{
    public class ResponseDTO
    {
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
        public string Message { get; set; } = string.Empty;
        public object? Data { get; set; }
        public DateTime serverTime { get; set; } = DateTime.UtcNow;
    }

    public class ExamDashboardDTO
    {
        public int ExamineeId { get; set; }
        public long? HrrecordId { get; set; }
        public int? BatchId { get; set; }
        public string? ExamName { get; set; }
        public int? ExamYear { get; set; }
        public int? QuestionSetId { get; set; }
        public int? ExamGradeId { get; set; }
        public string? ExamGradeName { get; set; }

        public int? MCQQuestion { get; set; }
        public int? MaxMCQQuestion { get; set; }
        public decimal? MCQMark { get; set; }

        public int? AcademicQuestion { get; set; }
        public int? GeneralQuestion { get; set; }
        public int? JobRelatedQuestion { get; set; }
        public int? TotalWrittenQuestion { get; set; }

        public int? MaxAcademicQuestion { get; set; }
        public int? MaxGeneralQuestion { get; set; }
        public int? MaxJobRelatedQuestion { get; set; }

        public int? TotalQuestion { get; set; }
        public decimal? WrittenMark { get; set; }
        public decimal? TotalMark { get; set; }

        public decimal? Mcqscore { get; set; }
        public decimal? WrittenScore { get; set; }
        public decimal? TotalScore { get; set; }

        public int? ExamDuration { get; set; }
        public DateTime? ExamStart { get; set; }
        public DateTime? ExamEnd { get; set; }
        public bool? IsAttand { get; set; }
        public bool? IsTimeExpire { get; set; }
        public bool IsActive { get; set; }
        public int? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }
    }

    public class ExamQuestion
    {
        public int questionId { get; set; }
        public string questionDetails { get; set; } = string.Empty;
        public int questionTypeId { get; set; }
        public decimal mark { get; set; }
        public DateTime examStart { get; set; }
        public DateTime examEnd { get; set; }
        public int examDuration { get; set; }
        public DateTime serverTime { get; set; } = DateTime.UtcNow;
        public int categoryId { get; set; }
        public int maxAcademic { get; set; }
        public int maxGeneral { get; set; }
        public int maxJobRelated { get; set; }
        public int maxMcq { get; set; }
        public int questionSeq { get; set; }
        public string statusMessage { get; set; } = string.Empty;
    }

    public class McqOption
    {
        public int optionId { get; set; }
        public int questionId { get; set; }
        public string optionDetails { get; set; } = string.Empty;
        public int answerSerial { get; set; }
    }

    public class ExamSheet
    {
        public List<ExamQuestion> questionList { get; set; } = new();
        public List<McqOption> mcqOption { get; set; } = new();
    }

    public class SubmitAnsDTO
    {
        public int examineeId { get; set; }
        public int questionId { get; set; }
        public int? answerId { get; set; }
        public string? answer { get; set; }
        public int questionTypeId { get; set; }
    }

    public class ExamFinishDTO
    {
        public int examineeId { get; set; }
        public DateTime machineTime { get; set; } = DateTime.UtcNow;
        public List<SubmitAnsDTO> answer { get; set; } = new();
    }

    public class AnswerSubmitResult
    {
        public DateTime currentTime { get; set; } = DateTime.UtcNow;
        public string submitStatus { get; set; } = "Success";
    }

    public class ExamEndResult
    {
        public string submitStatus { get; set; } = "Success";
        public DateTime submitTime { get; set; } = DateTime.UtcNow;
    }
}
