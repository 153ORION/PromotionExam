using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_Lookup")]
    public class SysLookup
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int LookupId { get; set; }

        public int TypeId { get; set; }

        [Required]
        [StringLength(250)]
        public string LookupText { get; set; } = string.Empty;

        [StringLength(100)]
        public string? LookupTextShort { get; set; }

        public int? Serial { get; set; }
        public bool? IsActive { get; set; }
        public long? EntryBy { get; set; }
        public DateTime? EntryDate { get; set; }
        public long? UpdateBy { get; set; }
        public DateTime? UpdateDate { get; set; }

        [ForeignKey("TypeId")]
        public virtual SysLookupType? LookupType { get; set; }
    }
}
