import { str } from "@/lib/coaching/auth"

export function exerciseData(body: Record<string, unknown>) {
  return {
    name: str(body.name) ?? "",
    muscleGroup: str(body.muscleGroup) ?? "FULLBODY",
    primaryMuscle: str(body.primaryMuscle),
    secondaryMuscles: str(body.secondaryMuscles),
    equipment: str(body.equipment),
    videoUrl: str(body.videoUrl),
    imageUrl: str(body.imageUrl),
    instructions: str(body.instructions),
    commonMistakes: str(body.commonMistakes),
  }
}
