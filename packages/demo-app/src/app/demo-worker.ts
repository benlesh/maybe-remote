import { createPostMessageService } from '@maybe-remote/core';
import * as ServiceDefinitions from './demo-service';

createPostMessageService({
  target: self,
  def: ServiceDefinitions,
});
