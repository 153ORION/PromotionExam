using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_Flowpath")]
    public class SysFlowpath
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Path_Id { get; set; }

        public int BatchId { get; set; }
        public int ExamSetId { get; set; }
        public int ExaminerId { get; set; }
        public int Rank { get; set; }
        public bool? Approver { get; set; }
        public int? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }
    }
}
