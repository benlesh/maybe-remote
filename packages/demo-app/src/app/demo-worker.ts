import { createPostMessageService } from '@maybe-remote/core';
import { rxjsServicePlugin } from '@maybe-remote/rxjs';

import * as ServiceDefinitions from './demo-service';

createPostMessageService({
  target: self,
  def: ServiceDefinitions,
  plugins: [rxjsServicePlugin()],
});
