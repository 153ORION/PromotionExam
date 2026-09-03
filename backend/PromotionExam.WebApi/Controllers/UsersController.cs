using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.DTOs.Auth;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UsersController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var hrRecordId))
                return Unauthorized();

            var user = await _context.SysUserRegistrations.FindAsync(hrRecordId);
            if (user == null)
                return NotFound();

            var profile = new UserProfileDto
            {
                HRRecordId = user.HRRecordId,
                LoginId = user.LoginId,
                Name = user.Name,
                Email = user.Email,
                Mobile = user.Mobile,
                Designation = user.Designation,
                GradeName = user.GradeName,
                CompanyName = user.CompanyName,
                DepartmentName = user.DepartmentName,
                LocationName = user.LocationName,
                ProfilePhotoPath = user.ProfilePhotoPath,
                IsAdmin = user.IsAdmin == true,
                IsSuperAdmin = user.IsSuperAdmin == true,
                IsActive = user.IsActive == true
            };

            return Ok(profile);
        }

        [Authorize(Roles = "SuperAdmin")]
        [HttpGet("management")]
        public async Task<IActionResult> GetUsers([FromQuery] string? search)
        {
            var query = _context.SysUserRegistrations.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(u => u.LoginId.Contains(s) || u.Name.Contains(s) || (u.Email != null && u.Email.Contains(s)));
            }

            var users = await query
                .OrderByDescending(u => u.IsSuperAdmin)
                .ThenByDescending(u => u.IsAdmin)
                .ThenBy(u => u.Name)
                .Take(100)
                .Select(u => new UserProfileDto
                {
                    HRRecordId = u.HRRecordId,
                    LoginId = u.LoginId,
                    Name = u.Name,
                    Email = u.Email,
                    Mobile = u.Mobile,
                    Designation = u.Designation,
                    GradeName = u.GradeName,
                    CompanyName = u.CompanyName,
                    DepartmentName = u.DepartmentName,
                    LocationName = u.LocationName,
                    ProfilePhotoPath = u.ProfilePhotoPath,
                    IsAdmin = u.IsAdmin == true,
                    IsSuperAdmin = u.IsSuperAdmin == true,
                    IsActive = u.IsActive == true
                })
                .ToListAsync();

            return Ok(users);
        }

        [Authorize(Roles = "SuperAdmin")]
        [HttpPost("role/{hrRecordId}")]
        public async Task<IActionResult> UpdateRole(long hrRecordId, [FromQuery] string role)
        {
            var user = await _context.SysUserRegistrations.FindAsync(hrRecordId);
            if (user == null)
                return NotFound(new { message = "User not found." });

            switch (role.ToLower())
            {
                case "superadmin":
                    user.IsSuperAdmin = true;
                    user.IsAdmin = true;
                    break;
                case "admin":
                    user.IsSuperAdmin = false;
                    user.IsAdmin = true;
                    break;
                case "member":
                    user.IsSuperAdmin = false;
                    user.IsAdmin = false;
                    break;
                default:
                    return BadRequest(new { message = "Invalid role. Supported roles: superadmin, admin, member" });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"User role updated to {role} successfully." });
        }

        [Authorize(Roles = "SuperAdmin")]
        [HttpPost("toggle-status/{hrRecordId}")]
        public async Task<IActionResult> ToggleStatus(long hrRecordId)
        {
            var user = await _context.SysUserRegistrations.FindAsync(hrRecordId);
            if (user == null)
                return NotFound(new { message = "User not found." });

            user.IsActive = !(user.IsActive == true);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"User status updated to {(user.IsActive == true ? "Active" : "Inactive")}.", isActive = user.IsActive });
        }
    }
}
