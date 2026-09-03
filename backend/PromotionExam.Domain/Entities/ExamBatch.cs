using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Exam_Batch")]
    public class ExamBatch
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int BatchId { get; set; }

        [Required]
        [StringLength(250)]
        public string ExamName { get; set; } = string.Empty;

        public int ExamYear { get; set; }
        public DateTime? ExamStart { get; set; }
        public DateTime? ExamEnd { get; set; }

        public int? MCQQuestion { get; set; }
        public int? MaxMCQ { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? MCQMark { get; set; }

        public int? AcademicQuestion { get; set; }
        public int? MaxAcademic { get; set; }
        public int? GeneralQuestion { get; set; }
        public int? MaxGeneral { get; set; }
        public int? JobRelatedQuestion { get; set; }
        public int? MaxJobRelated { get; set; }
        public int? TotalWrittenQuestion { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? WrittenMark { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalMark { get; set; }

        public int? ExamDuration { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsMultipleExaminer { get; set; } = true;
        public bool? AllowPreviewMarking { get; set; } = true;
        public int? EntryBy { get; set; }
    }
}
