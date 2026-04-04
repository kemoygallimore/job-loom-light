import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/uploadToStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Video, ChevronRight, Send, CheckCircle2, XCircle, Camera, Loader2, RotateCcw } from "lucide-react";
import { isAfter } from "date-fns";

interface ScreeningJob {
  id: string;
  company_id: string;
  title: string;
  question: string;
  expires_at: string;
}

type Step = "info" | "instructions" | "recording" | "review" | "submitted" | "expired" | "not-found";


export default function PublicScreening() {
  const { linkId } = useParams<{ linkId: string }>();
  const [job, setJob] = useState<ScreeningJob | null>(null);
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!linkId) {
        setStep("not-found");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("screening_jobs")
        .select("id, company_id, title, question, expires_at")
        .eq("unique_link_id", linkId)
        .maybeSingle();

      if (error || !data) {
        setStep("not-found");
        setLoading(false);
        return;
      }

      if (!isAfter(new Date(data.expires_at), new Date())) {
        setStep("expired");
        setLoading(false);
        return;
      }

      setJob(data as ScreeningJob);
      setLoading(false);
    };

    load();
  }, [linkId]);

  useEffect(() => {
    if ((step === "instructions" || step === "recording") && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      toast.error("Unable to access camera. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  const goToInstructions = () => {
    if (!name.trim() || !email.trim() || !consent) {
      toast.error("Please fill all fields and accept privacy consent");
      return;
    }

    setStep("instructions");
    startCamera();
  };

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];

    let mimeType = "video/webm";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "";
    }

    const mediaRecorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const finalType = chunksRef.current[0]?.type || mimeType || "video/webm";

      const blob = new Blob(chunksRef.current, { type: finalType });

      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
      setStep("review");
      stopCamera();
    };

    mediaRecorder.start();
    setRecording(true);
    setRecordTime(0);

    recordTimerRef.current = setInterval(() => {
      setRecordTime((prev) => {
        if (prev >= 29) {
          stopRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  }, [stopCamera, stopRecording, videoUrl]);

  const startCountdown = (seconds: number) => {
    clearTimers();
    setStep("recording");
    setCountdown(seconds);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const reRecord = async () => {
    clearTimers();

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoBlob(null);
    setVideoUrl(null);
    setAttempt(2);

    await startCamera();
    startCountdown(5);
  };

  const submitVideo = async () => {
    if (!videoBlob || !job) return;

    setSubmitting(true);

    try {
      const fileExtension = videoBlob.type.includes("mp4") ? "mp4" : "webm";

      const videoFile = new File([videoBlob], `${Date.now()}-${name.trim().replace(/\s+/g, "_")}.${fileExtension}`, {
        type: videoBlob.type || "video/webm",
      });

      const r2Result = await uploadToR2({
        file: videoFile,
        companyId: job.company_id,
        jobId: job.id,
        candidateId: email.trim().toLowerCase(),
        category: "video",
        backendBaseUrl: BACKEND_BASE_URL,
      });

      const { error: submissionError } = await supabase.from("screening_submissions").insert({
        screening_job_id: job.id,
        company_id: job.company_id,
        candidate_name: name.trim(),
        candidate_email: email.trim().toLowerCase(),
        video_url: r2Result.key,
        privacy_consent: true,
      });

      if (submissionError) {
        throw submissionError;
      }

      const { error: candidateFileError } = await supabase.from("candidate_files").insert({
        company_id: job.company_id,
        job_id: job.id,
        candidate_id: email.trim().toLowerCase(),
        category: "video",
        bucket: r2Result.bucket,
        file_key: r2Result.key,
        file_name: r2Result.fileName,
        file_type: r2Result.fileType,
        file_size: r2Result.fileSize,
      });

      if (candidateFileError) {
        throw candidateFileError;
      }

      setStep("submitted");
      toast.success("Video submitted successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit video");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
      stopCamera();

      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [clearTimers, stopCamera, videoUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Screening Not Found</h1>
          <p className="text-muted-foreground">This screening link is invalid or has been removed.</p>
        </div>
      </div>
    );
  }

  if (step === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Screening Expired</h1>
          <p className="text-muted-foreground">This screening job is no longer accepting submissions.</p>
        </div>
      </div>
    );
  }

  if (step === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 animate-fade-in-up">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">Submitted!</h1>
          <p className="text-muted-foreground">Your video has been submitted successfully. Thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl border shadow-lg overflow-hidden animate-scale-in">
        <div className="bg-primary text-primary-foreground px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Video className="w-5 h-5" />
            <span className="text-sm font-medium opacity-80">Video Screening</span>
          </div>
          <h1 className="text-xl font-bold">{job?.title}</h1>
        </div>

        <div className="p-6">
          {step === "info" && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} id="consent" />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  I consent to my video being recorded and reviewed by the hiring team for the purpose of this job
                  application.
                </label>
              </div>

              <Button onClick={goToInstructions} className="w-full gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === "instructions" && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" />
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm">Instructions</h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li>• You'll be shown a question to answer</li>
                  <li>
                    • You'll have a <strong>15 second countdown</strong> to prepare your answer
                  </li>
                  <li>
                    • Recording will start automatically and lasts <strong>max 30 seconds</strong>
                  </li>
                </ul>
              </div>

              <Button onClick={() => startCountdown(15)} className="w-full gap-2">
                <Camera className="w-4 h-4" /> I'm Ready
              </Button>
            </div>
          )}

          {step === "recording" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-muted/60 rounded-lg p-4 mb-2">
                <p className="text-sm font-medium mb-1">Your question:</p>
                <p className="text-sm text-muted-foreground">{job?.question}</p>
              </div>

              <div className="rounded-lg overflow-hidden bg-black aspect-video relative">
                <video ref={videoRef} className="w-full h-full object-cover" />

                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-center">
                      <div className="text-6xl font-bold text-white tabular-nums">{countdown}</div>
                      <p className="text-white/70 text-sm mt-2">
                        {attempt === 1
                          ? "Read the question above & prepare your answer..."
                          : "Get ready to re-record..."}
                      </p>
                    </div>
                  </div>
                )}

                {recording && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    REC {recordTime}s / 30s
                  </div>
                )}
              </div>

              {recording && (
                <Button onClick={stopRecording} variant="destructive" className="w-full">
                  Stop Recording
                </Button>
              )}
            </div>
          )}

          {step === "review" && videoUrl && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video src={videoUrl} controls className="w-full h-full" />
              </div>

              {attempt === 1 ? (
                <div className="flex gap-3">
                  <Button variant="outline" onClick={reRecord} className="flex-1 gap-2">
                    <RotateCcw className="w-4 h-4" /> Re-record
                  </Button>

                  <Button onClick={submitVideo} disabled={submitting} className="flex-1 gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              ) : (
                <Button onClick={submitVideo} disabled={submitting} className="w-full gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? "Submitting..." : "Submit Video"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
