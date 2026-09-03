namespace PromotionExam.Application.DTOs.Auth
{
    public class LoginRequestDto
    {
        public string LoginId { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public long HRRecordId { get; set; }
        public string LoginId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Designation { get; set; }
        public string? CompanyName { get; set; }
        public string? DepartmentName { get; set; }
        public string? LocationName { get; set; }
        public string? ProfilePhoto { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsSuperAdmin { get; set; }
        public List<MenuItemDto> Menus { get; set; } = new();
    }

    public class MenuItemDto
    {
        public int Id { get; set; }
        public int ParentId { get; set; }
        public string MenuName { get; set; } = string.Empty;
        public string? TargetUrl { get; set; }
        public string? MenuLogo { get; set; }
        public string? Color { get; set; }
        public decimal? SerialNo { get; set; }
        public List<MenuItemDto> Children { get; set; } = new();
    }

    public class ChangePasswordRequestDto
    {
        public string OldPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class UserProfileDto
    {
        public long HRRecordId { get; set; }
        public string LoginId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Mobile { get; set; }
        public string? Designation { get; set; }
        public string? GradeName { get; set; }
        public string? CompanyName { get; set; }
        public string? DepartmentName { get; set; }
        public string? LocationName { get; set; }
        public string? ProfilePhotoPath { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsSuperAdmin { get; set; }
        public bool IsActive { get; set; }
    }
}
