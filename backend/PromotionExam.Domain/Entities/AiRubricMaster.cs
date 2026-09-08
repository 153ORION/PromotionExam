using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Question_Bank_Answer_Rebric")]
    public class AiRubricMaster
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int RubricMasterId { get; set; }

        public int QuestionId { get; set; }
        public int VersionNo { get; set; }

        [Required]
        [StringLength(128)]
        public string RubricHash { get; set; } = string.Empty;

        [Required]
        public string QuestionSnapshot { get; set; } = string.Empty;

        public string? StandardAnswerSnapshot { get; set; }
        public string? SubjectSnapshot { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MaxMarks { get; set; }

        public string? RubricSummary { get; set; }
        public string? CriteriaJson { get; set; }

        [StringLength(100)]
        public string? SourceModel { get; set; }

        [StringLength(50)]
        public string? PromptVersion { get; set; }

        public bool IsActive { get; set; }
        public long? GeneratedBy { get; set; }
        public DateTime? EntryDate { get; set; }
        public DateTime? UpdateDate { get; set; }

        [ForeignKey("QuestionId")]
        public virtual QuestionBank? Question { get; set; }
    }
}
