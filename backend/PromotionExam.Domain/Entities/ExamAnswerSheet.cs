using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Exam_Answer_Sheet")]
    public class ExamAnswerSheet
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int EAS_Id { get; set; }

        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public int? AnswerId { get; set; }
        public string? Answer { get; set; }
        public DateTime? EntryDate { get; set; }

        [ForeignKey("QuestionId")]
        public virtual QuestionBank? Question { get; set; }
    }
}
