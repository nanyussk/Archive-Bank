import Fastify from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

const app = Fastify();
const PORT = 3000;
const BASE_DIR = path.resolve(process.cwd(), 'files');

const serverFile = async (reply, filePath) => {
  const type = mime.lookup(filePath) || 'application/octet-stream';
  reply.header('Content-Type', type);
  const data = await fs.readFile(filePath);
  reply.send(data);
};

const listDirectory = async (reply, req, dirPath, relPath) => {
  const baseUrl = `${req.protocol}://${req.hostname}/archives`;

  const dirents = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    dirents
      .filter(dirent => dirent.isFile())
      .map(async dirent => {
        const filePath = path.join(dirPath, dirent.name);
        const stat = await fs.stat(filePath);
        const fileUrlPath = path.join(relPath, dirent.name).replace(/\\/g, '/');
        return {
          filename: dirent.name,
          size: stat.size,
          mimeType: mime.lookup(dirent.name) || null,
          url: `${baseUrl}/${fileUrlPath}`,
        };
      })
  );

  reply.send(files);
};

app.get('/files/*', async (request, reply) => {
  try {
    const relPath = request.params['*'] || '';
    const fullPath = path.normalize(path.join(BASE_DIR, relPath));

    if (!fullPath.startsWith(BASE_DIR)) {
      return reply.status(403).send('Access Denied');
    }

    const stats = await fs.stat(fullPath);

    if (stats.isFile()) {
      return serverFile(reply, fullPath);
    }
    if (stats.isDirectory()) {
      return listDirectory(reply, request, fullPath, relPath);
    }

  } catch (error) {
    if (error.code === 'ENOENT') return reply.status(404).send('Not Found');
    console.error(error);
    return reply.status(500).send('Internal Server Error');
  }
});

app.listen({ port: PORT }, (err) => {
  if (err) throw err;
  console.log(`Base directory: ${BASE_DIR}`);
});