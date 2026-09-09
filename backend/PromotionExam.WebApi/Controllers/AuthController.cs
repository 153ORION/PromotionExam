using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PromotionExam.Application.Common.Interfaces;
using PromotionExam.Application.DTOs.CandidateAttempt;
using PromotionExam.Application.DTOs.Auth;
using PromotionExam.Infrastructure.Data;

namespace PromotionExam.WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICryptographyService _crypto;
        private readonly IJwtTokenGenerator _jwt;
        private readonly IUserActivityService _activityService;
        private readonly PromotionExam.Application.Common.Interfaces.ICandidateExamService _candidateExamService;

        public AuthController(
            ApplicationDbContext context, 
            ICryptographyService crypto, 
            IJwtTokenGenerator jwt,
            IUserActivityService activityService,
            PromotionExam.Application.Common.Interfaces.ICandidateExamService candidateExamService)
        {
            _context = context;
            _crypto = crypto;
            _jwt = jwt;
            _activityService = activityService;
            _candidateExamService = candidateExamService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.LoginId) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest(new { message = "Login ID and Password are required." });

            var user = await _context.SysUserRegistrations
                .FirstOrDefaultAsync(u => u.LoginId == request.LoginId.Trim() || (u.Email != null && u.Email == request.LoginId.Trim()));

            if (user == null)
                return Unauthorized(new { message = "User not found or not authorized for Promotion Assessment Platform." });

            if (user.IsActive == false)
                return Unauthorized(new { message = "Your account is inactive. Please contact System Administrator." });

            bool isPasswordValid = _crypto.VerifyPassword(request.Password.Trim(), user.Password ?? string.Empty);
            if (!isPasswordValid)
                return Unauthorized(new { message = "Invalid Employee ID or Password. Please try again." });

            var token = _jwt.GenerateToken(user);
            var menus = await GetUserMenusAsync(user.IsSuperAdmin == true);
            var isExaminerOfActiveBatch = await IsExaminerOfActiveBatchAsync(user.HRRecordId);

            var response = new LoginResponseDto
            {
                Token = token,
                HRRecordId = user.HRRecordId,
                LoginId = user.LoginId,
                Name = user.Name,
                Email = user.Email,
                Designation = user.Designation,
                CompanyName = user.CompanyName,
                DepartmentName = user.DepartmentName,
                LocationName = user.LocationName,
                ProfilePhoto = user.ProfilePhotoPath,
                IsAdmin = user.IsAdmin == true,
                IsSuperAdmin = user.IsSuperAdmin == true,
                IsExaminerOfActiveBatch = isExaminerOfActiveBatch,
                Menus = menus
            };

            var role = user.IsSuperAdmin == true ? "SuperAdmin" : (user.IsAdmin == true ? "Admin" : "Examinee");
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                user.HRRecordId,
                user.LoginId,
                user.Name,
                role,
                "AUTH",
                "LOGIN",
                $"User '{user.Name}' ({user.LoginId}) logged in as {role}.",
                ip);

            return Ok(response);
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var hrRecordId))
                return Unauthorized();

            var user = await _context.SysUserRegistrations.FindAsync(hrRecordId);
            if (user == null)
                return NotFound();

            var menus = await GetUserMenusAsync(user.IsSuperAdmin == true);
            var isExaminerOfActiveBatch = await IsExaminerOfActiveBatchAsync(user.HRRecordId);

            return Ok(new
            {
                user.HRRecordId,
                user.LoginId,
                user.Name,
                user.Email,
                user.Designation,
                user.CompanyName,
                user.DepartmentName,
                user.LocationName,
                user.GradeName,
                user.ProfilePhotoPath,
                IsAdmin = user.IsAdmin == true,
                IsSuperAdmin = user.IsSuperAdmin == true,
                IsExaminerOfActiveBatch = isExaminerOfActiveBatch,
                Menus = menus
            });
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto request)
        {
            if (request.NewPassword != request.ConfirmPassword)
                return BadRequest(new { message = "New Password and Confirm Password do not match." });

            if (request.NewPassword.Length < 4)
                return BadRequest(new { message = "Password must be at least 4 characters long." });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var hrRecordId))
                return Unauthorized();

            var user = await _context.SysUserRegistrations.FindAsync(hrRecordId);
            if (user == null)
                return NotFound();

            if (!_crypto.VerifyPassword(request.OldPassword, user.Password ?? string.Empty))
                return BadRequest(new { message = "Current password does not match." });

            user.Password = _crypto.EncryptLegacy(request.NewPassword);
            user.PasswordUpdateTime = DateTime.Now;
            await _context.SaveChangesAsync();

            var role = user.IsSuperAdmin == true ? "SuperAdmin" : (user.IsAdmin == true ? "Admin" : "Examinee");
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            await _activityService.LogAsync(
                user.HRRecordId,
                user.LoginId,
                user.Name,
                role,
                "AUTH",
                "PASSWORD_CHANGE",
                $"User '{user.Name}' changed their account password.",
                ip);

            return Ok(new { message = "Password changed successfully." });
        }

        private async Task<bool> IsExaminerOfActiveBatchAsync(long hrRecordId)
        {
            if (hrRecordId <= 0)
                return false;

            // An examiner assignment exists when the user is listed in Sys_Flowpath
            // for a question set of a currently active exam batch.
            return await _context.SysFlowpaths
                .AnyAsync(f => f.ExaminerId == hrRecordId
                    && _context.ExamBatches.Any(b => b.BatchId == f.BatchId && b.IsActive == true));
        }

        private async Task<List<MenuItemDto>> GetUserMenusAsync(bool isSuperAdmin)
        {
            var query = _context.SysMenus.Where(m => m.IS_ACTIVE == true);
            if (!isSuperAdmin)
            {
                query = query.Where(m => m.IS_PUBLIC == true);
            }

            var allMenus = await query.OrderBy(m => m.serial_no).ToListAsync();
            var parentMenus = allMenus.Where(m => m.parent_id == 0).ToList();

            var result = new List<MenuItemDto>();
            foreach (var parent in parentMenus)
            {
                var parentDto = new MenuItemDto
                {
                    Id = parent.id,
                    ParentId = 0,
                    MenuName = parent.menu_name,
                    TargetUrl = parent.target_url,
                    MenuLogo = parent.menu_logo,
                    Color = parent.color,
                    SerialNo = parent.serial_no,
                    Children = allMenus.Where(c => c.parent_id == parent.id).Select(c => new MenuItemDto
                    {
                        Id = c.id,
                        ParentId = c.parent_id,
                        MenuName = c.menu_name,
                        TargetUrl = c.target_url,
                        MenuLogo = c.menu_logo,
                        Color = c.color,
                        SerialNo = c.serial_no
                    }).ToList()
                };

                result.Add(parentDto);
            }

            return result;
        }

        #region -------- API Project Auth Endpoints --------

        [HttpGet("/Api/Auth/Login")]
        public async Task<ResponseDTO> LegacyLogin([FromQuery] string employeeId, [FromQuery] string password)
        {
            return await _candidateExamService.UserLogin(employeeId, password);
        }

        [HttpPost("/Api/Auth/UpdatePassword")]
        public async Task<ResponseDTO> LegacyUpdatePassword([FromQuery] string employeeId, [FromQuery] string password)
        {
            return await _candidateExamService.UpdatePassword(employeeId, password);
        }

        #endregion
    }
}
