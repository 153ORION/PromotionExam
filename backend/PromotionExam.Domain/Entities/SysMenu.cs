using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PromotionExam.Domain.Entities
{
    [Table("Sys_Menu")]
    public class SysMenu
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int id { get; set; }

        public int parent_id { get; set; }

        [Required]
        [StringLength(150)]
        public string menu_name { get; set; } = string.Empty;

        [StringLength(250)]
        public string? target_url { get; set; }

        [StringLength(100)]
        public string? menu_logo { get; set; }

        [StringLength(50)]
        public string? color { get; set; }

        public decimal? serial_no { get; set; }
        public bool? IS_ACTIVE { get; set; }
        public bool? IS_PUBLIC { get; set; }
    }
}
