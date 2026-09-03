using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Question_Set")]
    public class QuestionSet
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SetId { get; set; }

        [Required]
        [StringLength(250)]
        public string SetName { get; set; } = string.Empty;

        public int? LocationId { get; set; }
        public int? DepartmentId { get; set; }
        public int? GradeId { get; set; }
        public int? ConcentrationId { get; set; }
        public bool? IsActive { get; set; }
        public int? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }
        public int? UpdateBy { get; set; }
        public DateTime? UpdateDate { get; set; }
    }
}
