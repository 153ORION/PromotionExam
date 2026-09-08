using System;

namespace PromotionExam.Application.DTOs.Exam
{
    public class ExamBatchDto
    {
        public int BatchId { get; set; }
        public string ExamName { get; set; } = string.Empty;
        public int ExamYear { get; set; }
        public DateTime? ExamStart { get; set; }
        public DateTime? ExamEnd { get; set; }
        public int? MCQQuestion { get; set; }
        public int? MaxMCQ { get; set; }
        public decimal? MCQMark { get; set; }
        public int? AcademicQuestion { get; set; }
        public int? MaxAcademic { get; set; }
        public int? GeneralQuestion { get; set; }
        public int? MaxGeneral { get; set; }
        public int? JobRelatedQuestion { get; set; }
        public int? MaxJobRelated { get; set; }
        public int? TotalWrittenQuestion { get; set; }
        public decimal? WrittenMark { get; set; }
        public decimal? TotalMark { get; set; }
        public int? ExamDuration { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsMultipleExaminer { get; set; }
        public bool? AllowPreviewMarking { get; set; }
    }

    public class ExamBatchCreateUpdateDto
    {
        public int? BatchId { get; set; }
        public string ExamName { get; set; } = string.Empty;
        public int ExamYear { get; set; }
        public DateTime? ExamStart { get; set; }
        public DateTime? ExamEnd { get; set; }
        public int? MCQQuestion { get; set; }
        public int? MaxMCQ { get; set; }
        public decimal? MCQMark { get; set; }
        public int? AcademicQuestion { get; set; }
        public int? MaxAcademic { get; set; }
        public int? GeneralQuestion { get; set; }
        public int? MaxGeneral { get; set; }
        public int? JobRelatedQuestion { get; set; }
        public int? MaxJobRelated { get; set; }
        public int? TotalWrittenQuestion { get; set; }
        public decimal? WrittenMark { get; set; }
        public decimal? TotalMark { get; set; }
        public int? ExamDuration { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsMultipleExaminer { get; set; } = true;
        public bool? AllowPreviewMarking { get; set; } = true;
    }

    public class SysFlowpathDto
    {
        public int Path_Id { get; set; }
        public int BatchId { get; set; }
        public string? BatchName { get; set; }
        public int ExamSetId { get; set; }
        public string? SetName { get; set; }
        public int ExaminerId { get; set; }
        public string? ExaminerCode { get; set; }
        public string? ExaminerName { get; set; }
        public string? ExaminerDesignation { get; set; }
        public string? ExaminerDepartment { get; set; }
        public int Rank { get; set; }
        public bool? Approver { get; set; }
        public DateTime? EntryDate { get; set; }
    }

    public class FlowpathCreateDto
    {
        public int BatchId { get; set; }
        public int ExamSetId { get; set; }
        public int ExaminerId { get; set; }
        public int Rank { get; set; }
        public bool Approver { get; set; }
    }

    public class ExamRegistrationDto
    {
        public int ExamineeId { get; set; }
        public long HRRecordId { get; set; }
        public string LoginId { get; set; } = string.Empty;
        public string ExamineeName { get; set; } = string.Empty;
        public string? Designation { get; set; }
        public string? DepartmentName { get; set; }
        public string? CompanyName { get; set; }
        public string? LocationName { get; set; }
        public string? GradeName { get; set; }
        public int BatchId { get; set; }
        public string? BatchName { get; set; }
        public int QuestionSetId { get; set; }
        public string? SetName { get; set; }
        public int? ExamGradeId { get; set; }
        public string? ExamGradeName { get; set; }
        public decimal? MCQScore { get; set; }
        public decimal? WrittenScore { get; set; }
        public decimal? TotalScore { get; set; }
        public DateTime? ExamStart { get; set; }
        public DateTime? ExamEnd { get; set; }
        public bool? IsAttand { get; set; }
        public bool? IsExamEnd { get; set; }
        public bool? IsTimeExpire { get; set; }
        public bool? IsActive { get; set; }
    }

    public class RegistrationCreateDto
    {
        public string LoginId { get; set; } = string.Empty;
        public int BatchId { get; set; }
        public int QuestionSetId { get; set; }
        public int? PromotedGradeId { get; set; }
    }

    public class TimeEditorRequestDto
    {
        public int? BatchId { get; set; }
        public int? ExamineeId { get; set; }
        public int ExtraMinutes { get; set; }
    }
}
