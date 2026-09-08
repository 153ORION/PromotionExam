using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Exam_Narrative_AI_Evaluation")]
    public class ExamNarrativeAiEvaluation
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long AiEvaluationId { get; set; }

        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public int RubricMasterId { get; set; }

        public string? StudentAnswerSnapshot { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AwardedMarks { get; set; }

        [Column(TypeName = "decimal(5,4)")]
        public decimal? Confidence { get; set; }

        public string? Summary { get; set; }
        public string? StrengthsJson { get; set; }
        public string? MissingPointsJson { get; set; }
        public string? IncorrectPointsJson { get; set; }
        public string? CriterionBreakdownJson { get; set; }

        [Required]
        [StringLength(50)]
        public string ValidationStatus { get; set; } = "Validated";

        public string? ValidationNotes { get; set; }
        public bool ReviewRecommended { get; set; }

        [StringLength(100)]
        public string? SourceModel { get; set; }

        [StringLength(50)]
        public string? PromptVersion { get; set; }

        public long? RequestedBy { get; set; }
        public DateTime? EntryDate { get; set; }
        public DateTime? UpdateDate { get; set; }

        [ForeignKey("QuestionId")]
        public virtual QuestionBank? Question { get; set; }

        [ForeignKey("RubricMasterId")]
        public virtual AiRubricMaster? RubricMaster { get; set; }
    }
}
