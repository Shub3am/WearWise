'use client';

import { Stethoscope, Heart, Moon, Activity, Brain, Database, Workflow, Bot, Code, Cpu, Server, Sparkles } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
  // Heart & Breathing
  chestPain: z.boolean().default(false),
  shortnessOfBreath: z.boolean().default(false),
  irregularHeartbeat: z.boolean().default(false),
  rapidHeartbeat: z.boolean().default(false),
  
  // Sleep & Fatigue
  difficultyFallingAsleep: z.boolean().default(false),
  nightwaking: z.boolean().default(false),
  excessiveDaytimeSleepiness: z.boolean().default(false),
  fatigue: z.boolean().default(false),
  
  // Physical Activity & Energy
  muscleWeakness: z.boolean().default(false),
  reducedExerciseTolerance: z.boolean().default(false),
  jointPain: z.boolean().default(false),
  dizziness: z.boolean().default(false),
});

export default function Home() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chestPain: false,
      shortnessOfBreath: false,
      irregularHeartbeat: false,
      rapidHeartbeat: false,
      difficultyFallingAsleep: false,
      nightwaking: false,
      excessiveDaytimeSleepiness: false,
      fatigue: false,
      muscleWeakness: false,
      reducedExerciseTolerance: false,
      jointPain: false,
      dizziness: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Navbar */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto flex h-16 items-center px-4">
          <Stethoscope className="h-6 w-6 text-blue-600 mr-2" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">HealthTrack</h1>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* About Section */}
        <section className="mb-12 text-center">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">About HealthTrack</h2>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto">
            HealthTrack is an innovative health monitoring system that combines your Apple Watch data with symptom tracking to provide comprehensive health insights. Our platform helps you better understand your health patterns and make informed decisions about your well-being.
          </p>
        </section>

        {/* How It Works Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-center">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center justify-center">
                  <Workflow className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-center text-blue-800">Data Collection</h3>
                <p className="text-blue-600 text-center">
                  Seamlessly collect health data from your Apple Watch and combine it with your reported symptoms
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center justify-center">
                  <Brain className="h-12 w-12 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-center text-indigo-800">AI Analysis</h3>
                <p className="text-indigo-600 text-center">
                  Advanced AI algorithms analyze your data to identify patterns and potential health insights
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center justify-center">
                  <Bot className="h-12 w-12 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-center text-purple-800">Personalized Insights</h3>
                <p className="text-purple-600 text-center">
                  Receive personalized health recommendations and insights based on your unique data
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why This Application Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-center">Why HealthTrack?</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4 text-purple-800 text-center">Comprehensive Health Monitoring</h3>
                <p className="text-purple-700 text-center">
                  By combining Apple Watch data with your reported symptoms, we provide a complete picture of your health status and trends over time.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-100 border-blue-200">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4 text-blue-800 text-center">AI-Powered Insights</h3>
                <p className="text-blue-700 text-center">
                  Our advanced AI models analyze your health data to detect patterns and provide personalized recommendations for improving your well-being.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Form Section */}
        <Card className="mb-12 border-t-4 border-t-blue-500 max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Health Symptoms Questionnaire</CardTitle>
            <p className="text-gray-600">
              Please select any symptoms you are experiencing. This questionnaire focuses on symptoms that can be analyzed alongside your Apple Watch health data.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Heart & Breathing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Heart className="h-5 w-5 text-red-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Heart & Breathing</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {['chestPain', 'shortnessOfBreath', 'irregularHeartbeat', 'rapidHeartbeat'].map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name={item as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0 justify-center">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <Separator className="bg-blue-100" />

                {/* Sleep & Fatigue */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Moon className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Sleep & Fatigue</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {['difficultyFallingAsleep', 'nightwaking', 'excessiveDaytimeSleepiness', 'fatigue'].map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name={item as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0 justify-center">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <Separator className="bg-blue-100" />

                {/* Physical Activity & Energy */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Activity className="h-5 w-5 text-green-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Physical Activity & Energy</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {['muscleWeakness', 'reducedExerciseTolerance', 'jointPain', 'dizziness'].map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name={item as any}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0 justify-center">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Submit Questionnaire
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="border-t py-12 bg-white rounded-lg shadow-lg">
          <div className="max-w-4xl mx-auto px-4">
            <h3 className="text-2xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-center">Technology Stack</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800 text-center">Framework & Language</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Code className="h-5 w-5 text-blue-600" />
                    <span>Next.js 13</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Code className="h-5 w-5 text-blue-600" />
                    <span>TypeScript</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800 text-center">AI & Data</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Brain className="h-5 w-5 text-indigo-600" />
                    <span>RAG</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Database className="h-5 w-5 text-indigo-600" />
                    <span>Chroma DB</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800 text-center">AI Models</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <span>Llama 3.1</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    <span>Mixtral 8x7B</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span>ChatGPT 3.5</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800 text-center">Infrastructure</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <Server className="h-5 w-5 text-green-600" />
                    <span>Python</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <Cpu className="h-5 w-5 text-green-600" />
                    <span>Groq</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}