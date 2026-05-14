const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getConnection } = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const vocabularyRoutes = require('./routes/vocabulary.routes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/fronted', express.static(path.join(__dirname, '../fronted')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.redirect('/fronted/pages/pagina-principal.html');
});

app.get('/api/health', async (req, res) => {
  try {
    await getConnection();

    res.json({
      success: true,
      message: 'API y base de datos funcionando'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'API activa, pero falla conexión a BD',
      detail: error.message
    });
  }
});

/* =========================
   RUTA PARA LISTAR AUDIOS
   ========================= */
app.get('/api/audios', (req, res) => {
  const uploadsPath = path.join(__dirname, 'uploads');

  fs.readdir(uploadsPath, (error, files) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'No se pudieron leer los audios',
        detail: error.message
      });
    }

    const audioFiles = files
      .filter(file => /\.(mp3|wav|ogg|m4a)$/i.test(file))
      .map(file => ({
        filename: file,
        path: `uploads/${file}`,
        url: `/uploads/${file}`
      }));

    res.json({
      success: true,
      data: audioFiles
    });
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api', vocabularyRoutes);
app.use('/api/activities', activityRoutes);

/* Esta parte siempre debe ir al final */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Abre: http://localhost:${PORT}/fronted/pages/pagina-principal.html`);
});