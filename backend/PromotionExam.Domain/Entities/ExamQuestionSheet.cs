using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Exam_Question_Sheet")]
    public class ExamQuestionSheet
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long EQS_Id { get; set; }

        public int ExamineeId { get; set; }
        public int QuestionId { get; set; }
        public int QuestionSeq { get; set; }
        public DateTime? EntryDate { get; set; }
        public bool? IsActive { get; set; }

        [ForeignKey("QuestionId")]
        public virtual QuestionBank? Question { get; set; }
    }
}
