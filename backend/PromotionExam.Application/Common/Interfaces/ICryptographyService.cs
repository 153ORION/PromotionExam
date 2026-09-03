namespace PromotionExam.Application.Common.Interfaces
{
    public interface ICryptographyService
    {
        string EncryptLegacy(string plainText);
        string DecryptLegacy(string cipherText);
        bool VerifyPassword(string inputPassword, string storedPassword);
    }
}
