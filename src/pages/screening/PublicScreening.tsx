import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
      if (!linkId) { setStep("not-found"); setLoading(false); return; }
      const { data } = await supabase
        .from("screening_jobs")
        .select("id, company_id, title, question, expires_at")
        .eq("unique_link_id", linkId)
        .maybeSingle();

      if (!data) { setStep("not-found"); setLoading(false); return; }
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

  // Re-attach stream to video element whenever step changes or video ref mounts
  useEffect(() => {
    if ((step === "instructions" || step === "recording") && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
    } catch {
      toast.error("Unable to access camera. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const goToInstructions = () => {
    if (!name.trim() || !email.trim() || !consent) {
      toast.error("Please fill all fields and accept privacy consent");
      return;
    }
    setStep("instructions");
    startCamera();
  };

  const startCountdown = (seconds: number) => {
    setStep("recording");
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
      setStep("review");
      stopCamera();
    };
    mr.start();
    setRecording(true);
    setRecordTime(0);

    recordTimerRef.current = setInterval(() => {
      setRecordTime(prev => {
        if (prev >= 29) {
          stopRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    clearInterval(recordTimerRef.current!);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const reRecord = async () => {
    setVideoBlob(null);
    setVideoUrl(null);
    setAttempt(2);
    await startCamera();
    // Go directly to recording with 5-second countdown (no instructions step)
    startCountdown(5);
  };

  const submitVideo = async () => {
    if (!videoBlob || !job) return;
    setSubmitting(true);

    try {
      const fileName = `${job.id}/${Date.now()}-${name.replace(/\s/g, "_")}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("screening-videos")
        .upload(fileName, videoBlob, { contentType: "video/webm" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("screening-videos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("screening_submissions").insert({
        screening_job_id: job.id,
        company_id: job.company_id,
        candidate_name: name.trim(),
        candidate_email: email.trim(),
        video_url: urlData.publicUrl,
        privacy_consent: true,
      });

      if (insertError) throw insertError;
      setStep("submitted");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit video");
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [stopCamera]);

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
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Video className="w-5 h-5" />
            <span className="text-sm font-medium opacity-80">Video Screening</span>
          </div>
          <h1 className="text-xl font-bold">{job?.title}</h1>
        </div>

        <div className="p-6">
          {/* Step 1: Info */}
          {step === "info" && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" required />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} id="consent" />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  I consent to my video being recorded and reviewed by the hiring team for the purpose of this job application.
                </label>
              </div>
              <Button onClick={goToInstructions} className="w-full gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Instructions + Camera Preview */}
          {step === "instructions" && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" />
              </div>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm">Instructions</h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li>• You'll be shown a question to answer</li>
                  <li>• You'll have a <strong>15 second countdown</strong> to prepare your answer</li>
                  <li>• Recording will start automatically and lasts <strong>max 30 seconds</strong></li>
                </ul>
              </div>
              <Button onClick={() => startCountdown(15)} className="w-full gap-2">
                <Camera className="w-4 h-4" /> I'm Ready
              </Button>
            </div>
          )}

          {/* Step 3: Countdown + Recording */}
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

          {/* Step 4: Review */}
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
