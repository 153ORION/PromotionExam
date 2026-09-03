using PromotionExam.Domain.Entities;

namespace PromotionExam.Application.Common.Interfaces
{
    public interface IJwtTokenGenerator
    {
        string GenerateToken(SysUserRegistration user);
    }
}
