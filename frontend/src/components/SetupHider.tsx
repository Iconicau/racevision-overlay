interface Props {
  imageData: string | null;
}

export function SetupHider({ imageData }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ background: imageData ? "black" : "rgba(10, 10, 18, 0.97)" }}
    >
      {imageData ? (
        <img
          src={imageData}
          alt="Setup screen hidden"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 select-none">
          <div className="text-4xl font-black text-white/10 uppercase tracking-[0.3em]">
            IN SETUP
          </div>
          <div className="text-xs text-white/20 uppercase tracking-widest">
            Screen hidden for stream
          </div>
        </div>
      )}
    </div>
  );
}
