import React, { useState } from 'react';

export const CIKGU_ADIBAH_PHOTO_SRC = '/assets/aistudio/image_4b826126.png';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CikguAdibahAvatarProps {
  size?: AvatarSize;
  shape?: 'circle' | 'rounded';
  speaking?: boolean;
  ringColor?: 'emerald' | 'gold';
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-5 h-5',
  sm: 'w-11 h-11',
  md: 'w-14 h-14',
  lg: 'w-24 h-24 sm:w-28 sm:h-28',
  xl: 'w-28 h-28 sm:w-36 sm:h-36',
};

export function CikguAdibahAvatar({
  size = 'lg',
  shape = 'rounded',
  speaking = false,
  ringColor = 'emerald',
  className = '',
}: CikguAdibahAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const borderClass =
    ringColor === 'gold'
      ? 'border-2 border-amber-300 shadow-[0_0_24px_rgba(250,204,21,0.42)]'
      : 'border-2 border-emerald-400/75 shadow-[0_0_18px_rgba(16,185,129,0.3)]';

  return (
    <div
      className={`relative ${SIZE_CLASSES[size]} ${shapeClass} ${borderClass} bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center ${className}`}
    >
      {!imgFailed ? (
        <img
          src={CIKGU_ADIBAH_PHOTO_SRC}
          alt="Ejen Adiburgh – Wira Pembimbing EcoWorld"
          onError={() => setImgFailed(true)}
          draggable={false}
          className="w-full h-full object-cover object-[54%_14%] scale-[1.06] origin-[54%_22%] select-none"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-sky-700 to-emerald-800 flex items-center justify-center font-game font-black text-white text-sm">
          CA
        </div>
      )}

      {speaking && (
        <div
          className="absolute bottom-1.5 inset-x-2 flex items-end justify-center gap-1 h-4 pointer-events-none"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((idx) => (
            <span
              key={idx}
              style={{ animationDelay: `${idx * 0.09}s` }}
              className="w-1 h-3.5 rounded-full bg-amber-300 wave-bar-active shadow-[0_1px_4px_rgba(2,6,23,0.9)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
