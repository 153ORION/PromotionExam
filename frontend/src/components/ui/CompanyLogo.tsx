import React, { useState } from 'react';
import { useSystemConfig, DEFAULT_LOGO_URL } from '@/context/SystemConfigContext';
import { Building2 } from 'lucide-react';
import { resolveApiUrl } from '@/services/api';

interface CompanyLogoProps {
  className?: string;
  containerClassName?: string;
  fallbackText?: string;
  alt?: string;
  showName?: boolean;
  nameClassName?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = 'h-10 w-10 object-contain',
  containerClassName = '',
  fallbackText,
  alt,
  showName = false,
  nameClassName = 'text-sm font-bold text-slate-800'
}) => {
  const { config } = useSystemConfig();
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);

  // Uploaded logo first, then the bundled one, then the initials badge below.
  const logoSrc = [resolveApiUrl(config?.logoUrl), DEFAULT_LOGO_URL]
    .find((src): src is string => !!src && !failedSrcs.includes(src));
  const companyName = config?.companyName || 'ORION';
  const shortInitials = fallbackText || config?.companyShortName || companyName.slice(0, 2).toUpperCase() || 'PE';

  return (
    <div className={`inline-flex items-center space-x-2 ${containerClassName}`}>
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={alt || companyName}
          className={className}
          onError={() => setFailedSrcs((prev) => [...prev, logoSrc])}
        />
      ) : (
        <div className={`flex items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm ${className}`}>
          {shortInitials ? (
            <span className="text-xs font-black tracking-tighter">{shortInitials}</span>
          ) : (
            <Building2 className="h-4 w-4" />
          )}
        </div>
      )}
      {showName && (
        <span className={nameClassName}>
          {companyName}
        </span>
      )}
    </div>
  );
};
