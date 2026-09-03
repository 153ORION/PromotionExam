using System.Collections.Generic;

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
}
