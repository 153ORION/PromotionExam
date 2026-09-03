using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_LookupType")]
    public class SysLookupType
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int TypeId { get; set; }

        [Required]
        [StringLength(150)]
        public string LookupType { get; set; } = string.Empty;

        public int? Serial { get; set; }
        public bool? IsActive { get; set; }
        public long? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }
        public long? UpdateBy { get; set; }
        public DateTime? UpdateDate { get; set; }
    }
}
