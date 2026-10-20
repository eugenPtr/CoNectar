// Read-only calibration fixture. Run with the Gateway credential loaded locally.
import { gatewayEmbedder } from "../lib/people-search/ai-gateway";
import { heartProjectEmbeddingInput } from "../lib/heart-projects/save";

const themes = [
  { name: "Spații comunitare", description: "Crearea și administrarea de locuri fizice pentru întâlniri și activități ale comunității." },
  { name: "Sănătate și terapie", description: "Sprijin pentru sănătate fizică, emoțională și psihică prin practici terapeutice." },
  { name: "Educație și învățare", description: "Cursuri, ateliere și programe prin care oamenii dobândesc cunoștințe și abilități." },
  { name: "Artă și cultură", description: "Expresie artistică, dans, muzică și proiecte culturale deschise comunității." },
  { name: "Natură și agricultură", description: "Îngrijirea ecosistemelor, agroecologie, grădinărit și producție alimentară durabilă." },
  { name: "Tehnologie civică", description: "Instrumente digitale dezvoltate pentru a rezolva nevoi ale comunității." },
];
const projects = [
  { title: "Casa dansului", description: "Amenajăm un spațiu unde oamenii pot dansa, participa la spectacole și întâlni artiști." },
  { title: "Refugiu terapeutic", description: "Construim un loc de retragere pentru terapie de grup, consiliere și vindecare emoțională." },
  { title: "Școala de terapie", description: "Organizăm cursuri pentru oameni care vor să învețe metode de terapie și consiliere." },
  { title: "Pădure hrană", description: "Creăm un spațiu de agroforesterie cu livezi, grădini și îngrijirea solului." },
  { title: "Reparații biciclete", description: "Repar bicicletele vecinilor în timpul meu liber." },
];
const cosine = (a: number[], b: number[]) => {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const left = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const right = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return dot / left / right;
};
async function main() {
  const vectors = await Promise.all([...themes.map((theme) => heartProjectEmbeddingInput({ title: theme.name, description: theme.description })), ...projects.map(heartProjectEmbeddingInput)].map(gatewayEmbedder));
  for (let i = 0; i < projects.length; i++) {
    const scores = themes.map((theme, j) => ({ theme: theme.name, score: cosine(vectors[themes.length + i], vectors[j]) }));
    console.log(projects[i].title, scores.sort((a, b) => b.score - a.score).map(({ theme, score }) => `${theme}: ${score.toFixed(3)}`).join(" | "));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
