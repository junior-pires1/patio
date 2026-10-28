import { criarApp } from './app';
import { lerAmbiente } from './config/ambiente';

const ambiente = lerAmbiente();
const app = criarApp(ambiente);

app.listen(ambiente.PORT, () => {
  console.warn(`API do Pátio em http://localhost:${ambiente.PORT}`);
});
