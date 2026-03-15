import app from "./app";
import { AuthRepository } from "./modules/auth/auth.repository";

const PORT = process.env.PORT || 3000;

AuthRepository.cleanUpRefreshTokens();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
