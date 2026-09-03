using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Exam_Narrative_Score")]
    public class ExamNarrativeScore
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long ScoreId { get; set; }

        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public long ExaminerId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Marks { get; set; }

        public string? Remarks { get; set; }
        public DateTime? EntryDate { get; set; }
        public DateTime? UpdateDate { get; set; }

        [ForeignKey("QuestionId")]
        public virtual QuestionBank? Question { get; set; }
    }
}
