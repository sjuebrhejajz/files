"use client"

// Always rendered muted — this is a silent, looping background layer only.
// Any audible sound on the profile comes from the separate <ProfileAudioPlayer />
// music widget, never from this element, regardless of what the source file contains.
export function ProfileVideoBackground({ src }: { src: string }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        // Belt-and-suspenders: some browsers briefly unmute autoplaying video
        // if a user later interacts with the element directly.
        onVolumeChange={(e) => {
          const v = e.currentTarget
          if (!v.muted) v.muted = true
        }}
        className="size-full object-cover"
      />
      <div className="absolute inset-0 bg-background/40" />
    </div>
  )
}
