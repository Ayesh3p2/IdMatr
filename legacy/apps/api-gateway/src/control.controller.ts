import {
  Controller, All, Param, Body, Req, Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://control-plane:3010';

@Controller('control')
export class ControlProxyController {
  /**
   * Proxy all requests to /control/* to the Control Plane service
   */
  @All(':param1*')
  async proxyControlRequest(
    @Param('param1') param1: string,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: any,
  ) {
    try {
      // Build the full path by extracting everything after /control
      const controlIndex = req.url.indexOf('/control');
      const path = req.url.substring(controlIndex + 8); // Skip '/control'
      const proxyUrl = `${CONTROL_PLANE_URL}${path}`;
      const urlObj = new URL(proxyUrl);

      // Prepare request options
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: urlObj.host,
          'x-forwarded-for': typeof req.headers['x-forwarded-for'] === 'string'
            ? req.headers['x-forwarded-for']
            : req.ip,
        },
      };

      const protocol = urlObj.protocol === 'https:' ? https : http;
      const proxyReq = protocol.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        res.status(500).json({ error: error.message });
      });

      if (body) {
        proxyReq.write(JSON.stringify(body));
      }
      proxyReq.end();
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Internal server error' });
    }
  }
}


