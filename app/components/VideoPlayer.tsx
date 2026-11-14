import React, { useState, useRef } from "react";
import {
	Play,
	Pause,
	Volume2,
	VolumeX,
	Maximize,
	Minimize,
	RotateCcw,
	RotateCw,
	PictureInPicture2,
} from "lucide-react";
import { Button } from "~/components/ui/button";

interface VideoPlayerProps {
	src: string;
	title?: string;
}

export function VideoPlayer({ src, title }: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(1);
	const [isMuted, setIsMuted] = useState(false);
	const [playbackRate, setPlaybackRate] = useState(1);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showControls, setShowControls] = useState(true);
	const [isHovered, setIsHovered] = useState(false);

	let hideTimeout: NodeJS.Timeout;

	// Handle play/pause toggle
	const togglePlay = () => {
		if (!videoRef.current) return;
		if (isPlaying) {
			videoRef.current.pause();
		} else {
			videoRef.current.play();
		}
		setIsPlaying(!isPlaying);
	};

	const handleTimeUpdate = () => {
		if (!videoRef.current) return;
		setCurrentTime(videoRef.current.currentTime);
	};

	const handleLoadedMetadata = () => {
		if (!videoRef.current) return;
		setDuration(videoRef.current.duration);
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = parseFloat(e.target.value);
		setCurrentTime(time);
		if (videoRef.current) {
			videoRef.current.currentTime = time;
		}
	};

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		setVolume(val);
		setIsMuted(val === 0);
		if (videoRef.current) {
			videoRef.current.volume = val;
		}
	};

	const toggleMute = () => {
		if (!videoRef.current) return;
		if (isMuted) {
			videoRef.current.volume = volume || 1;
			setIsMuted(false);
		} else {
			videoRef.current.volume = 0;
			setIsMuted(true);
		}
	};

	const handleSkip = (seconds: number) => {
		if (!videoRef.current) return;
		videoRef.current.currentTime = Math.min(
			Math.max(videoRef.current.currentTime + seconds, 0),
			duration,
		);
	};

	const changePlaybackRate = (rate: number) => {
		setPlaybackRate(rate);
		if (videoRef.current) {
			videoRef.current.playbackRate = rate;
		}
	};

	const togglePiP = async () => {
		if (!videoRef.current) return;
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
			} else if (document.pictureInPictureEnabled) {
				await videoRef.current.requestPictureInPicture();
			}
		} catch (err) {
			console.error("PiP error:", err);
		}
	};

	const toggleFullscreen = () => {
		if (!containerRef.current) return;
		if (!document.fullscreenElement) {
			containerRef.current.requestFullscreen();
			setIsFullscreen(true);
		} else {
			document.exitFullscreen();
			setIsFullscreen(false);
		}
	};

	const formatTime = (timeInSeconds: number) => {
		const minutes = Math.floor(timeInSeconds / 60);
		const seconds = Math.floor(timeInSeconds % 60);
		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	};

	// Auto-hide controls after inactivity
	const handleMouseMove = () => {
		setShowControls(true);
		clearTimeout(hideTimeout);
		if (isPlaying) {
			hideTimeout = setTimeout(() => {
				if (!isHovered) setShowControls(false);
			}, 3000);
		}
	};

	const progressPercentage =
		duration > 0 && Number.isFinite(duration) ? Math.min((currentTime / duration) * 100, 100) : 0;

	return (
		<div
			ref={containerRef}
			onMouseMove={handleMouseMove}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => {
				setIsHovered(false);
				if (isPlaying) setShowControls(false);
			}}
			className="relative group w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl flex items-center justify-center select-none border border-border"
		>
			<video
				ref={videoRef}
				src={src}
				onTimeUpdate={handleTimeUpdate}
				onLoadedMetadata={handleLoadedMetadata}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onClick={togglePlay}
				className="w-full h-full object-contain cursor-pointer"
				playsInline
			/>

			{/* Center Play Overlay on Pause */}
			{!isPlaying && (
				<div
					onClick={togglePlay}
					className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs cursor-pointer transition-opacity"
				>
					<div className="w-16 h-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
						<Play className="w-8 h-8 fill-current ml-1" />
					</div>
				</div>
			)}

			{/* Control Bar Overlay */}
			<div
				className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-col gap-2 transition-opacity duration-300 ${
					showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
				}`}
			>
				{/* Title if present */}
				{title && <div className="text-white text-xs font-medium truncate mb-1">{title}</div>}

				{/* Progress bar */}
				<div className="flex items-center gap-3">
					<input
						type="range"
						min={0}
						max={duration || 100}
						value={currentTime}
						onChange={handleSeek}
						style={{
							background: `linear-gradient(to right, white ${progressPercentage}%, rgb(255 255 255 / 30%) ${progressPercentage}%)`,
						}}
						className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-secondary hover:h-2.5 transition-all"
					/>
				</div>

				{/* Controls row */}
				<div className="flex items-center justify-between text-white">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={togglePlay}
							className="text-white h-9 w-9"
						>
							{isPlaying ? (
								<Pause className="w-5 h-5" />
							) : (
								<Play className="w-5 h-5 fill-current" />
							)}
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleSkip(-5)}
							className="text-white h-8 w-8"
							title="Rewind 5s"
						>
							<RotateCcw className="w-4 h-4" />
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleSkip(5)}
							className="text-white h-8 w-8"
							title="Fast Forward 5s"
						>
							<RotateCw className="w-4 h-4" />
						</Button>

						{/* Volume */}
						<div className="flex items-center gap-2 group/vol">
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleMute}
								className="text-white h-8 w-8"
							>
								{isMuted || volume === 0 ? (
									<VolumeX className="w-5 h-5" />
								) : (
									<Volume2 className="w-5 h-5" />
								)}
							</Button>
							<input
								type="range"
								min={0}
								max={1}
								step={0.05}
								value={isMuted ? 0 : volume}
								onChange={handleVolumeChange}
								className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>

						{/* Time */}
						<span className="text-xs font-mono text-white/80">
							{formatTime(currentTime)} / {formatTime(duration)}
						</span>
					</div>

					<div className="flex items-center gap-2">
						{/* Speed Selector */}
						<div className="relative group/speed">
							<Button
								variant="ghost"
								size="sm"
								className="text-xs text-white h-8 px-2 font-mono"
							>
								{playbackRate}x
							</Button>
							<div className="absolute bottom-full right-0 mb-2 hidden group-hover/speed:flex flex-col bg-popover text-popover-foreground rounded-md shadow-lg border border-border p-1 min-w-[70px]">
								{[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
									<button
										key={rate}
										onClick={() => changePlaybackRate(rate)}
										className={`text-xs px-2 py-1 rounded text-left hover:bg-accent ${
											playbackRate === rate
												? "bg-accent font-semibold text-accent-foreground"
												: ""
										}`}
									>
										{rate}x
									</button>
								))}
							</div>
						</div>

						<Button
							variant="ghost"
							size="icon"
							onClick={togglePiP}
							className="text-white h-8 w-8"
							title="Picture-in-Picture"
						>
							<PictureInPicture2 className="w-4 h-4" />
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onClick={toggleFullscreen}
							className="text-white h-8 w-8"
							title="Fullscreen"
						>
							{isFullscreen ? (
								<Minimize className="w-4 h-4" />
							) : (
								<Maximize className="w-4 h-4" />
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
