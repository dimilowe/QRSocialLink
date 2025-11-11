import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFeedbackSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { MessageSquare, ArrowLeft } from "lucide-react";

const feedbackFormSchema = insertFeedbackSchema.omit({ userId: true });

type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

export default function FeedbackPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      type: "general",
      subject: "",
      message: "",
      email: user?.email || "",
    },
  });

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/feedback", data);
      const result = await response.json();
      
      setIsSuccess(true);
      form.reset();
      
      toast({
        title: "Feedback submitted",
        description: result.message,
      });
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-heading">Share Your Feedback</CardTitle>
                <CardDescription className="mt-1">
                  Help us improve QR Social by sharing your thoughts, reporting bugs, or suggesting features
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
                <p className="text-muted-foreground mb-6">
                  Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setIsSuccess(false)}
                    data-testid="button-submit-another"
                  >
                    Submit Another
                  </Button>
                  <Button
                    onClick={() => setLocation("/")}
                    data-testid="button-return-home"
                  >
                    Return Home
                  </Button>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Feedback Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-feedback-type" className="h-12">
                              <SelectValue placeholder="Select feedback type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bug">Bug Report</SelectItem>
                            <SelectItem value="feature">Feature Request</SelectItem>
                            <SelectItem value="improvement">Improvement Suggestion</SelectItem>
                            <SelectItem value="general">General Feedback</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the category that best describes your feedback
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief summary of your feedback"
                            {...field}
                            data-testid="input-subject"
                            className="h-12"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide details about your feedback..."
                            className="min-h-[150px] resize-none"
                            {...field}
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormDescription>
                          Be as detailed as possible to help us understand your feedback
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Email {!user && <span className="text-destructive">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            {...field}
                            data-testid="input-email"
                            className="h-12"
                          />
                        </FormControl>
                        <FormDescription>
                          {user
                            ? "We'll use this email if we need to follow up on your feedback"
                            : "Required so we can follow up on your feedback"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12"
                    disabled={isSubmitting}
                    data-testid="button-submit-feedback"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
